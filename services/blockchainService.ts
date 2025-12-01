import { ethers } from 'ethers';
import { TOKEN_ABI, ERC4626_ABI, REWARDS_ABI, CHAINLINK_ABI, CHAINLINK_FEEDS, DEFAULT_REWARDS_CONTROLLER, LIDO_ADDRESS, LIDO_ABI, BLOCKS_PER_DAY, WATCH_LIST_TOKENS } from '../constants';
import { OnChainData, Logger, DiscoveredAsset, AnalysisResult, DailyEarning, WalletBalances, TokenBalance } from '../types';

// ==========================================
// Helper: Oracle Price Fetch
// ==========================================
type PriceCache = Map<string, number>;

const getAssetPriceInUSD = async (address: string, provider: ethers.JsonRpcProvider, priceCache?: PriceCache): Promise<number> => {
    if (!address) return 0.0;
    const lowerCaseAddress = address.toLowerCase();

    // 1. Check cache first
    if (priceCache && priceCache.has(lowerCaseAddress)) {
        return priceCache.get(lowerCaseAddress)!;
    }

    // All keys in CHAINLINK_FEEDS are lowercase.
    const feedAddress = CHAINLINK_FEEDS[lowerCaseAddress];

    if (!feedAddress) {
        console.warn(`No Chainlink feed found for address: ${address}`);
        return 0.0;
    }

    try {
        const feed = new ethers.Contract(feedAddress, CHAINLINK_ABI, provider);
        const [ , answer, , , ] = await feed.latestRoundData();
        const decimals = await feed.decimals();
        const price = parseFloat(ethers.formatUnits(answer, decimals));

        // 2. Store in cache
        if (priceCache) {
            priceCache.set(lowerCaseAddress, price);
        }
        
        return price;
    } catch (e) {
        console.warn(`Chainlink oracle fetch failed for address: ${address}. This asset may be valued at $0 unless a fallback is applied.`);
        return 0.0; 
    }
};

// ==========================================
// 1. Asset Discovery
// ==========================================
export const discoverActiveAssets = async (userAddress: string, rpcUrl: string, log: Logger): Promise<DiscoveredAsset[]> => {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const activeAssets: DiscoveredAsset[] = [];

    // --- A. Scan Umbrella Assets ---
    log(`Connecting to Umbrella Rewards Controller...`, 'network');
    const rewardsContract = new ethers.Contract(DEFAULT_REWARDS_CONTROLLER, REWARDS_ABI, provider);
    let allAssets: string[] = [];
    try {
        allAssets = await rewardsContract.getAllAssets();
        log(`[Discovery] Controller manages ${allAssets.length} assets.`, 'success');
    } catch (e) {
        try { allAssets = await rewardsContract.getAssetsList(); } catch(e2) {}
    }

    await Promise.all(allAssets.map(async (assetAddr) => {
        try {
            const tokenContract = new ethers.Contract(assetAddr, TOKEN_ABI, provider);
            const balanceBN = await tokenContract.balanceOf(userAddress);
            if (balanceBN > 0n) {
                const [name, symbol, decimalsBN] = await Promise.all([
                    tokenContract.name().catch(() => 'Unknown'),
                    tokenContract.symbol().catch(() => 'UNK'),
                    tokenContract.decimals().catch(() => 18n)
                ]);
                let underlyingSymbol = symbol.replace('stkwa', '').replace('stk', '');
                if (underlyingSymbol.startsWith('Eth')) underlyingSymbol = underlyingSymbol.substring(3);
                if (underlyingSymbol.endsWith('v1')) underlyingSymbol = underlyingSymbol.replace('v1', '');

                activeAssets.push({
                    id: assetAddr,
                    address: assetAddr,
                    name,
                    symbol,
                    underlyingSymbol: underlyingSymbol || symbol
                });
                log(`[Discovery] Found Umbrella Position: ${symbol}`, 'success');
            }
        } catch (e) {}
    }));

    // --- B. Scan Lido stETH ---
    try {
        const lidoContract = new ethers.Contract(LIDO_ADDRESS, LIDO_ABI, provider);
        const balanceBN = await lidoContract.sharesOf(userAddress);
        if (balanceBN > 0n) {
            log(`[Discovery] Found Lido Position: stETH`, 'success');
            activeAssets.push({
                id: LIDO_ADDRESS,
                address: LIDO_ADDRESS,
                name: 'Liquid staked Ether 2.0',
                symbol: 'stETH',
                underlyingSymbol: 'ETH'
            });
        }
    } catch (e) {
        // Lido check failed
    }

    if (activeAssets.length === 0) {
        log('[Discovery] No active staking assets found for this address.', 'info');
    }

    return activeAssets;
};

// ==========================================
// 2. Data Fetching
// ==========================================
export const fetchOnChainData = async (userAddress: string, contractAddress: string, days: number, rpcUrl: string, log: Logger, priceCache: PriceCache = new Map()): Promise<OnChainData> => {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const isLido = contractAddress.toLowerCase() === LIDO_ADDRESS.toLowerCase();
    
    // ----------------------------------------
    // PATH A: LIDO stETH
    // ----------------------------------------
    if (isLido) {
        const lidoContract = new ethers.Contract(contractAddress, LIDO_ABI, provider);
        const symbol = 'stETH';
        const name = 'Liquid staked Ether 2.0';
        const decimals = 18;
        
        log(`[Analysis] Analyzing ${symbol} (Lido) over last ${days} days...`, 'info');
        
        // Oracle Price (stETH -> USD)
        const usdPrice = await getAssetPriceInUSD(contractAddress, provider, priceCache);
        log(`[Oracle] Price for ${symbol}: $${usdPrice.toFixed(2)}`, 'info');

        // History Loop
        const historyPoints = days;
        const historicalDataRaw: any[] = [];
        const currentBlock = await provider.getBlockNumber();

        const fetchLidoAtBlock = async (block: number, dateStr: string) => {
            try {
                const overrides = { blockTag: block };
                // 1. Get Shares (Static balance representation)
                const sharesBN = await lidoContract.sharesOf(userAddress, overrides);
                const shares = parseFloat(ethers.formatUnits(sharesBN, decimals));
                
                // 2. Get Exchange Rate (Total Pooled ETH / Total Shares)
                // We calculate this by checking how much ETH 1 Share is worth
                const oneShareBN = ethers.parseUnits("1", decimals);
                const oneShareValBN = await lidoContract.getPooledEthByShares(oneShareBN, overrides);
                const exchangeRate = parseFloat(ethers.formatUnits(oneShareValBN, decimals));

                // 3. Underlying Value (ETH amount) = Shares * Rate
                const userUnderlyingValue = shares * exchangeRate; 
                
                return {
                    block,
                    date: dateStr,
                    balance: shares, // We track shares to show "balance" stability
                    underlyingValue: userUnderlyingValue,
                    exchangeRate,
                    rewards: 0 // Lido rewards are intrinsic in the exchange rate (rebasing)
                };
            } catch(e) { return null; }
        };

        // Sequential Fetch
        const today = new Date();
        const currentData = await fetchLidoAtBlock(currentBlock, 'Today');
        if(currentData) historicalDataRaw.push(currentData);

        for (let i = 1; i <= historyPoints; i++) {
            const targetBlock = currentBlock - (BLOCKS_PER_DAY * i);
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (i % 5 === 0) await new Promise(r => setTimeout(r, 50)); 
            const data = await fetchLidoAtBlock(targetBlock, dateStr);
            if (data) historicalDataRaw.push(data);
        }

        // Clean Up
        historicalDataRaw.sort((a, b) => a.block - b.block);
        const validData = historicalDataRaw.filter(d => d.exchangeRate > 0);
        
        const finalCurrent = validData[validData.length - 1] || { balance: 0, underlyingValue: 0 };
        log(`[Analysis] Completed trace for stETH.`, 'success');

        return {
            currentBalance: finalCurrent.balance,
            currentUnderlyingValue: finalCurrent.underlyingValue,
            historicalData: validData,
            totalSupply: 0, 
            blockNumber: currentBlock,
            symbol,
            name,
            contractAddress,
            id: contractAddress,
            usdPrice,
            underlyingAddress: contractAddress
        };
    }

    // ----------------------------------------
    // PATH B: AAVE UMBRELLA (Existing Logic)
    // ----------------------------------------
    const stakeContract = new ethers.Contract(contractAddress, [...TOKEN_ABI, ...ERC4626_ABI], provider);
    
    // Dynamic Discovery of Rewards Controller
    let rewardsControllerAddress = DEFAULT_REWARDS_CONTROLLER;
    try {
        const rc = await stakeContract.REWARD_CONTROLLER();
        if (rc && rc !== ethers.ZeroAddress) {
            rewardsControllerAddress = rc;
        }
    } catch (e) {
         try {
             const ic = await stakeContract.getIncentivesController();
             if (ic && ic !== ethers.ZeroAddress) rewardsControllerAddress = ic;
         } catch(e2) {}
    }
    
    const rewardsContract = new ethers.Contract(rewardsControllerAddress, REWARDS_ABI, provider);

    const currentBlock = await provider.getBlockNumber();

    const [stkDecimalsBN, symbol, name, totalSupplyBN] = await Promise.all([
      stakeContract.decimals().catch(() => 18n),
      stakeContract.symbol().catch(() => 'UNKNOWN'),
      stakeContract.name().catch(() => 'Unknown Token'),
      stakeContract.totalSupply().catch(() => 0n)
    ]);
    
    const stkDecimals = Number(stkDecimalsBN);
    const totalSupply = parseFloat(ethers.formatUnits(totalSupplyBN, stkDecimals));
    log(`[Analysis] Analyzing ${symbol} over last ${days} days...`, 'info');

    // Resolve Chain
    let waTokenAddress: string | null = null;
    let waDecimals = 18;
    let underlyingDecimals = 18;
    let waContract: ethers.Contract | null = null;
    let underlyingAddress = '';

    try {
        waTokenAddress = await stakeContract.asset();
        if (waTokenAddress) {
            waContract = new ethers.Contract(waTokenAddress, [...ERC4626_ABI, ...TOKEN_ABI], provider);
            waDecimals = Number(await waContract.decimals().catch(() => 18n));

            underlyingAddress = await waContract.asset().catch(() => null);
            if (underlyingAddress) {
                const underlyingContract = new ethers.Contract(underlyingAddress, TOKEN_ABI, provider);
                underlyingDecimals = Number(await underlyingContract.decimals().catch(() => 18n));
            } else {
                underlyingDecimals = waDecimals;
                underlyingAddress = waTokenAddress; // fallback
            }
        }
    } catch (e) {
        // Silently fail chain resolution
    }

    // Fetch USD Price
    let usdPrice = 0.0;
    if (underlyingAddress) {
        usdPrice = await getAssetPriceInUSD(underlyingAddress, provider, priceCache);
        log(`[Oracle] Price for ${symbol} (underlying: ${underlyingAddress}): $${usdPrice.toFixed(4)}`, 'info');
    }

    // Fallback for stablecoins if oracle fails
    if (usdPrice === 0.0) {
        log(`[Oracle] Lookup failed for ${symbol}. Attempting fallback based on symbol name.`, 'warn');
        const normalizedSymbol = symbol.toUpperCase();
        if (normalizedSymbol.includes('USDT') || normalizedSymbol.includes('USDC') || normalizedSymbol.includes('DAI')) {
            usdPrice = 1.0;
            log(`[Oracle] Symbol contains stablecoin ticker. Applying $1.00 fallback price.`, 'success');
        }
    }

    // Cache for reward token metadata
    const rewardTokenCache: Record<string, { decimals: number, symbol: string }> = {};
    const getRewardTokenInfo = async (addr: string) => {
        if (rewardTokenCache[addr]) return rewardTokenCache[addr];
        try {
            const t = new ethers.Contract(addr, TOKEN_ABI, provider);
            const [d, s] = await Promise.all([
                t.decimals().catch(() => 18n),
                t.symbol().catch(() => 'UNK')
            ]);
            rewardTokenCache[addr] = { decimals: Number(d), symbol: s };
            return rewardTokenCache[addr];
        } catch (e) {
             return { decimals: 18, symbol: 'UNK' };
        }
    };

    // 5. Fetch Loop
    const historyPoints = days;
    const historicalDataRaw: any[] = [];
    
    const resolveExchangeRateAtBlock = async (block: number): Promise<number | null> => {
        try {
            const overrides = { blockTag: block };
            const oneShareBN = ethers.parseUnits("1", stkDecimals);
            
            const waAmountBN = await stakeContract.previewRedeem(oneShareBN, overrides);
            let underlyingAmountBN = waAmountBN;
            if (waContract) {
                underlyingAmountBN = await waContract.previewRedeem(waAmountBN, overrides);
            }
            return parseFloat(ethers.formatUnits(underlyingAmountBN, underlyingDecimals));
        } catch (e) {
            return null;
        }
    };

    const fetchDataAtBlock = async (block: number, dateStr: string) => {
      try {
        const overrides = { blockTag: block };
        
        // A. Balance
        const balanceBN = await stakeContract.balanceOf(userAddress, overrides);
        const balance = parseFloat(ethers.formatUnits(balanceBN, stkDecimals));
        
        // B. Rate
        const exchangeRate = await resolveExchangeRateAtBlock(block);
        if (exchangeRate === null) {
            return null;
        }
        const userUnderlyingValue = balance * exchangeRate;

        // C. Rewards - DYNAMIC DECIMALS STRATEGY
        let totalRewards = 0.0;
        
        try {
            const result = await rewardsContract.calculateCurrentUserRewards(contractAddress, userAddress, overrides);
            
            const rewardsList = result[0];
            const unclaimedAmounts = result[1]; 
            
            if (unclaimedAmounts && unclaimedAmounts.length > 0) {
                 for(let k=0; k < unclaimedAmounts.length; k++) {
                    const rTokenAddr = rewardsList[k];
                    const rawAmt = unclaimedAmounts[k];
                    
                    const info = await getRewardTokenInfo(rTokenAddr);
                    const val = parseFloat(ethers.formatUnits(rawAmt, info.decimals));
                    totalRewards += val;
                 }
            }
        } catch (calcErr: any) {
             // Fallback
             try {
                 const result = await rewardsContract.getRewardsByAsset(contractAddress, userAddress, overrides);
                 const rewardsListFb = result[0];
                 const unclaimedAmountsFb = result[1];
                 if (unclaimedAmountsFb && unclaimedAmountsFb.length > 0) {
                    for(let k=0; k < unclaimedAmountsFb.length; k++) {
                       const rTokenAddr = rewardsListFb[k];
                       const rawAmt = unclaimedAmountsFb[k];
                       const info = await getRewardTokenInfo(rTokenAddr);
                       const val = parseFloat(ethers.formatUnits(rawAmt, info.decimals));
                       totalRewards += val;
                    }
                 }
             } catch (fallbackErr: any) {}
        }

        return {
          block,
          date: dateStr,
          balance,
          underlyingValue: userUnderlyingValue,
          exchangeRate,
          rewards: totalRewards
        };
      } catch (e: any) {
        return null;
      }
    };

    // Sequential Fetch
    const today = new Date();
    
    const currentData = await fetchDataAtBlock(currentBlock, 'Today');
    if (currentData) {
        historicalDataRaw.push(currentData);
        log(`[Analysis] > Current Balance: ${currentData.balance.toFixed(2)} Shares`, 'info');
    }

    for (let i = 1; i <= historyPoints; i++) {
      const targetBlock = currentBlock - (BLOCKS_PER_DAY * i);
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 50)); 
      
      const data = await fetchDataAtBlock(targetBlock, dateStr);
      if (data) historicalDataRaw.push(data);
    }

    // Filter Outliers & Return
    historicalDataRaw.sort((a, b) => a.block - b.block);
    const validData = historicalDataRaw.filter(d => d.exchangeRate > 0);

    if (validData.length === 0) {
         log('[Error] No valid data points found.', 'error');
         return {
            currentBalance: 0,
            currentUnderlyingValue: 0,
            historicalData: [],
            totalSupply,
            blockNumber: currentBlock,
            symbol,
            name,
            contractAddress,
            id: contractAddress,
            usdPrice,
            underlyingAddress
        };
    }
    
    const finalCurrent = validData[validData.length - 1];
    log(`[Analysis] Completed trace for ${symbol}.`, 'success');

    return {
      currentBalance: finalCurrent.balance,
      currentUnderlyingValue: finalCurrent.underlyingValue,
      historicalData: validData,
      totalSupply,
      blockNumber: currentBlock,
      symbol,
      name,
      contractAddress,
      id: contractAddress,
      usdPrice,
      underlyingAddress
    };

  } catch (error: any) {
    log(`[Error] Fatal Error for ${contractAddress}: ${error.message}`, 'error');
    throw new Error(error.message);
  }
};

// ==========================================
// 3. Calculation Logic
// ==========================================
export const processData = (onChainData: OnChainData): AnalysisResult => {
    // 1. Calculate Realized Earnings from History
    const realizedEarnings: DailyEarning[] = [];
    const history = onChainData.historicalData;

    for (let i = 0; i < history.length; i++) {
        const current = history[i];
        const prev = i > 0 ? history[i-1] : null;

        let lendingGain = 0;
        let rewardGain = 0;

        if (prev) {
            // Lending Gain = Balance * (Rate_T2 - Rate_T1)
            const rateDiff = current.exchangeRate - prev.exchangeRate;
            if (rateDiff > 0.00000000000000001) {
                lendingGain = rateDiff * current.balance;
            }

            // Reward Gain = Unclaimed Rewards Increase
            const rewardDiff = current.rewards - prev.rewards;
            if (rewardDiff > 0) {
                rewardGain = rewardDiff;
            }

        }

        const totalDailyYield = lendingGain + rewardGain;
        const dailyApy = current.underlyingValue > 0 ? (totalDailyYield / current.underlyingValue) * 365 : 0;

        realizedEarnings.push({
            date: current.date,
            lendingEarnings: lendingGain,
            incentiveEarnings: rewardGain,
            totalDailyYield,
            balance: current.balance,
            underlyingValue: current.underlyingValue * onChainData.usdPrice, // Convert to USD for chart
            isHistorical: true,
            dailyApy,
        });
    }

    const latestEarning = realizedEarnings[realizedEarnings.length - 1];
    const daysCovered = Math.max(1, realizedEarnings.length - 1);

    const totalYield = realizedEarnings.reduce((acc, curr) => acc + curr.totalDailyYield, 0);
    const totalLending = realizedEarnings.reduce((acc, curr) => acc + curr.lendingEarnings, 0);
    const totalRewards = realizedEarnings.reduce((acc, curr) => acc + curr.incentiveEarnings, 0);

    // Period Earnings = Sum of all daily yields
    const periodEarnings = totalYield;

    // APY Calculation based on AVERAGE daily yield over the period
    const avgDailyYield = totalYield / daysCovered;
    // IMPORTANT: Use the raw underlying value from onChainData for APY calculation, not the USD value from realizedEarnings
    const currentValInAsset = onChainData.currentUnderlyingValue;
    
    const derivedApy = (currentValInAsset > 0) 
        ? (avgDailyYield * 365) / currentValInAsset 
        : 0;

    const yieldBreakdown = `Lending: ${(totalLending/totalYield*100 || 0).toFixed(0)}% + Rewards: ${(totalRewards/totalYield*100 || 0).toFixed(0)}%`;

    return {
        stats: {
            apy: derivedApy,
            totalStaked: (onChainData.totalSupply / 1000000).toFixed(2) + "M", 
            priceUsd: onChainData.usdPrice, 
            lastUpdated: new Date().toLocaleDateString(),
            yieldBreakdown: yieldBreakdown,
            periodEarnings: periodEarnings
        },
        earnings: realizedEarnings,
    onChainData: onChainData
  };
};

// ==========================================
// 4. Wallet Balance Fetching
// ==========================================
export const fetchWalletBalances = async (userAddress: string, rpcUrl: string, log: Logger, priceCache: PriceCache = new Map()): Promise<WalletBalances> => {
    log(`[Network] Fetching main wallet balances for ${userAddress}...`, 'network');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balances: TokenBalance[] = [];
    let totalValueUSD = 0;

    const tokenPromises = Object.values(WATCH_LIST_TOKENS).map(async (token) => {
        try {
            let balanceBN: bigint;
            let priceUSD = 0;

            if (token.symbol === 'ETH') {
                balanceBN = await provider.getBalance(userAddress);
                priceUSD = await getAssetPriceInUSD(WATCH_LIST_TOKENS['WETH'].address, provider, priceCache); // Use WETH for ETH price
            } else {
                const tokenContract = new ethers.Contract(token.address, TOKEN_ABI, provider);
                balanceBN = await tokenContract.balanceOf(userAddress);
                priceUSD = await getAssetPriceInUSD(token.address, provider, priceCache);
            }

            const balance = parseFloat(ethers.formatUnits(balanceBN, token.decimals));
            
            if (balance > 0.00001) { // Only add if balance is significant
                const valueUSD = balance * priceUSD;
                balances.push({
                    symbol: token.symbol,
                    balance,
                    valueUSD,
                    priceUSD,
                });
                totalValueUSD += valueUSD;
                log(`[Wallet] Found: ${balance.toFixed(4)} ${token.symbol} ($${valueUSD.toFixed(2)})`, 'info');
            }
        } catch (e: any) {
            log(`[Error] Could not fetch balance for ${token.symbol}: ${e.message}`, 'error');
        }
    });

    await Promise.all(tokenPromises);
    
    // Sort by value
    balances.sort((a, b) => b.valueUSD - a.valueUSD);

    log('[Success] Finished fetching wallet balances.', 'success');
    return { balances, totalValueUSD };
}

// ==========================================
// 5. Watch List Price Fetching
// ==========================================
export const fetchWatchListPrices = async (rpcUrl: string, log: Logger, priceCache: PriceCache = new Map()): Promise<{symbol: string, price: number, address: string, decimals: number}[]> => {
    log('[Oracle] Fetching prices for watch list tokens...', 'network');
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const tokens = Object.values(WATCH_LIST_TOKENS);
    
    // Process in chunks to avoid rate limits if necessary, but parallel is usually fine for read calls
    const promises = tokens.map(async (token) => {
        try {
            // Use WETH address for ETH price lookup if needed, or just rely on the feed mapping
            // In constants.ts, ETH is mapped to 0xEeeee... which doesn't have a direct feed in CHAINLINK_FEEDS usually unless mapped.
            // But let's check getAssetPriceInUSD logic.
            // It uses CHAINLINK_FEEDS[address.toLowerCase()]. 
            // We need to ensure ETH address is mapped there or handle it. 
            // Looking at constants.ts, '0xEeeee...' is NOT in CHAINLINK_FEEDS. 
            // However, WETH is. So for ETH, we should use WETH's address for price lookup.
            
            let lookupAddress = token.address;
            if (token.symbol === 'ETH') {
                lookupAddress = WATCH_LIST_TOKENS['WETH'].address;
            }

            const price = await getAssetPriceInUSD(lookupAddress, provider, priceCache);
            
            if (price > 0) {
                 return {
                    symbol: token.symbol,
                    price,
                    address: token.address,
                    decimals: token.decimals
                };
            }
            return null;
        } catch (e) {
            log(`[Error] Failed to fetch price for ${token.symbol}`, 'error');
            return null;
        }
    });

    const resultsRaw = await Promise.all(promises);
    const results = resultsRaw.filter(item => item !== null) as {symbol: string, price: number, address: string, decimals: number}[];

    log(`[Oracle] Updated prices for ${results.length} watch list tokens.`, 'success');
    
    return results;
};

// ==========================================
// 6. Gas Analytics
// ==========================================
export const fetchGasAnalytics = async (rpcUrl: string, log: Logger): Promise<{ latest: number, median: number, top20Avg: number, bottom80Avg: number, min: number, max: number } | null> => {
    try {
        log('[Network] Fetching gas analytics (last 5 blocks)...', 'network');
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Fetch 5 blocks of history. 
        // Result baseFeePerGas will have 6 items: [b1, b2, b3, b4, b5, next_b6]
        // Using provider.send to avoid TS issues with getFeeHistory
        const history = await provider.send("eth_feeHistory", ["0x5", "latest", []]);
        
        if (!history || !history.baseFeePerGas || history.baseFeePerGas.length < 5) {
            throw new Error("Insufficient gas history data");
        }

        // We use the 5 mined blocks (indices 0 to 4) for statistics
        const baseFeesRaw = history.baseFeePerGas.slice(0, 5).map((v: string) => Number(v)); // wei
        
        // Convert to Gwei
        const baseFeesGwei = baseFeesRaw.map(v => v / 1e9);
        
        // Sort for stats
        const sorted = [...baseFeesGwei].sort((a, b) => a - b);
        
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];
        
        // Top 20% of 5 is 1 block (Index 4)
        const top20Count = Math.max(1, Math.floor(sorted.length * 0.2));
        const top20 = sorted.slice(sorted.length - top20Count);
        const top20Avg = top20.reduce((a, b) => a + b, 0) / top20.length;
        
        // Bottom 80% of 5 is 4 blocks (Indices 0-3)
        const bottom80Count = sorted.length - top20Count;
        const bottom80 = sorted.slice(0, bottom80Count);
        const bottom80Avg = bottom80.length > 0 ? bottom80.reduce((a, b) => a + b, 0) / bottom80.length : 0;

        // Latest mined block is the last one in our slice (index 4 of original array, or last of sorted? NO, last of original slice)
        const latest = baseFeesGwei[baseFeesGwei.length - 1];

        log(`[Network] Gas Analytics: Latest ${latest.toFixed(2)} Gwei`, 'success');

        return {
            latest,
            median,
            top20Avg,
            bottom80Avg,
            min,
            max
        };

    } catch (e: any) {
        log(`[Error] Failed to fetch gas analytics: ${e.message}`, 'error');
        return null;
    }
};
