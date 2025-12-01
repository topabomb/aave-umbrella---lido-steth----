import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Wallet, TrendingUp, ShieldCheck, AlertCircle, Loader2, Coins, Layers, Calendar, DollarSign, Activity, PieChart, Droplets, Info, Server, Eye, Flame } from 'lucide-react';
import StatsCard from './components/StatsCard';
import EarningsChart from './components/EarningsChart';
import LogPanel from './components/LogPanel';
import WalletBalanceCard from './components/WalletBalanceCard';
import { fetchOnChainData, discoverActiveAssets, processData, fetchWalletBalances, fetchWatchListPrices, fetchGasAnalytics } from './services/blockchainService';
import * as storage from './services/storageService';
import { AnalysisResult, LogEntry, DiscoveredAsset, WalletBalances } from './types';
import { ANALYSIS_OPTIONS } from './constants';

const App: React.FC = () => {
  const [address, setAddress] = useState(storage.getItem('userAddress') || '');
  const [rpcUrl, setRpcUrl] = useState(storage.getItem('rpcUrl') || 'https://rpc.ankr.com/eth');
  const [days, setDays] = useState(() => {
      const saved = storage.getItem('analysisDays');
      return saved ? parseInt(saved, 10) : 7;
  });
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [discoveredAssets, setDiscoveredAssets] = useState<DiscoveredAsset[]>([]);
  const [walletBalances, setWalletBalances] = useState<WalletBalances | null>(null);
  const [watchListPrices, setWatchListPrices] = useState<{symbol: string, price: number}[]>([]);
  const [gasData, setGasData] = useState<{ latest: number, median: number, top20Avg: number, bottom80Avg: number, min: number, max: number } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const [ethers, setEthers] = useState<any>(null);

  React.useEffect(() => {
    import('ethers').then(m => setEthers(m.ethers));
  }, []);

  // Effect to scroll to top when loading finishes
  const wasLoading = useRef(false);
  useEffect(() => {
    if (wasLoading.current && !loading) {
      document.getElementById('top-section')?.scrollIntoView({ behavior: 'smooth' });
    }
    wasLoading.current = loading;
  }, [loading]);

  // Persist address and rpcUrl to localStorage on change
  useEffect(() => {
    storage.setItem('userAddress', address);
  }, [address]);

  useEffect(() => {
    storage.setItem('rpcUrl', rpcUrl);
  }, [rpcUrl]);

  useEffect(() => {
      storage.setItem('analysisDays', days.toString());
  }, [days]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { timestamp: time, message, type }]);
  };

  // Calculate Aggregated Metrics for Global, Lido, and Umbrella
  const { globalSummary, lidoSummary, umbrellaSummary } = useMemo(() => {
      const lido = {
          totalValueUSD: 0, totalDailyEarningsUSD: 0, totalPeriodEarningsUSD: 0,
          weightedAPYNumerator: 0, assetCount: 0,
      };
      const umbrella = {
          totalValueUSD: 0, totalDailyEarningsUSD: 0, totalPeriodEarningsUSD: 0,
          weightedAPYNumerator: 0, assetCount: 0,
      };

      Object.values(results).forEach((res: AnalysisResult) => {
          if (!res.onChainData) return;
          const valUSD = res.onChainData.currentUnderlyingValue * res.stats.priceUsd;
          const dailyYield = res.stats.periodEarnings / Math.max(1, days);
          const dailyYieldUSD = dailyYield * res.stats.priceUsd;
          const periodEarningsUSD = res.stats.periodEarnings * res.stats.priceUsd;

          const target = res.onChainData.symbol === 'stETH' ? lido : umbrella;
          target.totalValueUSD += valUSD;
          target.totalDailyEarningsUSD += dailyYieldUSD;
          target.totalPeriodEarningsUSD += periodEarningsUSD;
          target.weightedAPYNumerator += (res.stats.apy * valUSD);
          target.assetCount++;
      });
      
      const globalTotalValue = lido.totalValueUSD + umbrella.totalValueUSD;
      const globalNumerator = lido.weightedAPYNumerator + umbrella.weightedAPYNumerator;

      return {
          globalSummary: {
              totalValueUSD: globalTotalValue,
              totalDailyEarningsUSD: lido.totalDailyEarningsUSD + umbrella.totalDailyEarningsUSD,
              totalPeriodEarningsUSD: lido.totalPeriodEarningsUSD + umbrella.totalPeriodEarningsUSD,
              avgAPY: globalTotalValue > 0 ? globalNumerator / globalTotalValue : 0,
              assetCount: lido.assetCount + umbrella.assetCount,
          },
          lidoSummary: { 
              ...lido, 
              avgAPY: lido.totalValueUSD > 0 ? lido.weightedAPYNumerator / lido.totalValueUSD : 0 
          },
          umbrellaSummary: { 
              ...umbrella, 
              avgAPY: umbrella.totalValueUSD > 0 ? umbrella.weightedAPYNumerator / umbrella.totalValueUSD : 0 
          }
      };
  }, [results, days]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !rpcUrl) return;

    setLoading(true);
    setError(null);
    setResults({});
    setDiscoveredAssets([]);
    setWalletBalances(null);
    setWatchListPrices([]);
    setGasData(null);
    setLogs([]); 
    addLog(`[Analysis] Starting analysis for wallet: ${address}`, 'info');
    addLog(`[Network] Using RPC Node: ${rpcUrl}`, 'network');

    try {
      if (!ethers.isAddress(address)) throw new Error("无效的钱包地址 (Invalid Wallet Address)");

      const priceCache = new Map<string, number>();
      setStatusMessage("正在扫描链上资产 (Scanning Assets)...");
      
      // Fetch wallet balances, watchlist prices, and gas analytics in parallel
      
      fetchGasAnalytics(rpcUrl, addLog)
          .then(setGasData)
          .catch(err => addLog(`[Error] Could not fetch gas analytics: ${err.message}`, 'error'));

      fetchWatchListPrices(rpcUrl, addLog, priceCache)
          .then(setWatchListPrices)
          .catch(err => addLog(`[Error] Could not fetch watch list prices: ${err.message}`, 'error'));

      fetchWalletBalances(address, rpcUrl, addLog, priceCache)
          .then(setWalletBalances)
          .catch(err => addLog(`[Error] Could not fetch wallet balances: ${err.message}`, 'error'));
      
      const assets = await discoverActiveAssets(address, rpcUrl, addLog);
      
      if (assets.length === 0) {
          setError("该地址没有活跃的 Umbrella 或 Lido 质押资产。");
          setLoading(false);
          return;
      }

      setDiscoveredAssets(assets);
      setStatusMessage(`发现 ${assets.length} 个资产。开始 ${days} 天历史回溯...`);

      const newResults: Record<string, AnalysisResult> = {};
      
      for (const asset of assets) {
          setStatusMessage(`正在分析 ${asset.symbol} (${days} days)...`);
          addLog(`[Analysis] Starting trace for ${asset.name}...`, 'info');
          
          try {
              const onChainData = await fetchOnChainData(address, asset.address, days, rpcUrl, addLog, priceCache);
              
              addLog(`[Analysis] History loaded for ${asset.symbol}. Calculating Yield...`, 'info');
              const analysis = processData(onChainData);
              addLog(`[Success] Report Ready: ${asset.symbol}`, 'success');
              
              newResults[asset.address] = analysis;
              setResults({...newResults}); 
          } catch (err: any) {
              addLog(`[Error] Failed to analyze ${asset.symbol}: ${err.message}`, 'error');
          }
      }

    } catch (err: any) {
      const msg = err.message || "An unexpected error occurred during analysis.";
      setError(msg);
      addLog(`[Error] ${msg}`, 'error');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-aave-dark text-aave-text font-sans pb-12">
      <header className="border-b border-gray-800 bg-aave-dark/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-aave-primary to-aave-secondary flex items-center justify-center">
              <Activity className="text-white" size={18} />
            </div>
            <span className="font-bold text-xl tracking-tight">DeFi<span className="text-aave-secondary">Yield</span> Analyst</span>
          </div>
          <div className="text-xs text-aave-muted hidden sm:flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
             Ethereum Mainnet | Yield • Market • Gas
          </div>
        </div>
      </header>

      <main id="top-section" className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 space-y-2 sm:py-4 sm:space-y-4">
        
        {/* Search Section */}
        <section className="bg-aave-card p-6 rounded-2xl border border-gray-700 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-aave-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
             
             <div className="relative z-10 max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold mb-3 text-white text-center">全景收益分析 (Yield Inspector)</h1>
                <p className="text-aave-muted mb-6 text-sm">
                  集成 <span className="text-white font-mono bg-gray-800 px-1 rounded">Aave Umbrella</span> & <span className="text-white font-mono bg-gray-800 px-1 rounded">Lido stETH</span> 收益分析。
                  实时监控市场价格与网络 Gas 概览，助您精准决策。
                </p>

                <form onSubmit={handleAnalyze} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="输入钱包地址 (0x...)"
                          className="w-full bg-aave-dark border border-gray-600 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-aave-secondary outline-none font-mono text-sm shadow-inner transition-all"
                        />
                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      </div>
                       <div className="relative">
                        <input
                          type="text"
                          value={rpcUrl}
                          onChange={(e) => setRpcUrl(e.target.value)}
                          placeholder="输入 RPC 节点 URL"
                          className="w-full bg-aave-dark border border-gray-600 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-aave-secondary outline-none font-mono text-sm shadow-inner transition-all"
                        />
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      </div>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                          <select 
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="w-full h-full bg-aave-dark border border-gray-600 rounded-xl py-3 pl-10 pr-8 appearance-none cursor-pointer focus:ring-2 focus:ring-aave-secondary outline-none text-sm font-bold text-white shadow-inner"
                          >
                             {ANALYSIS_OPTIONS.map(opt => (
                                 <option key={opt.days} value={opt.days}>{opt.label}</option>
                             ))}
                          </select>
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-500"></div>
                      </div>
                       <button
                        type="submit"
                        disabled={loading || !ethers || !address || !rpcUrl}
                        className="w-full bg-gradient-to-r from-aave-primary to-aave-secondary hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? <><Loader2 className="animate-spin" size={20} /> 扫描与分析中...</> : <><Search size={20} /> 开始全景扫描</>}
                      </button>
                    </div>
                </form>
                {loading && <p className="text-xs text-aave-secondary mt-3 animate-pulse text-center">{statusMessage}</p>}
             </div>
        </section>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} /> <p>{error}</p>
          </div>
        )}

        {/* Gas Analytics Panel */}
        {gasData && (
            <div className="animate-fade-in space-y-3 bg-[#1a1e30] border border-gray-700/50 rounded-2xl p-4 shadow-xl">
                 <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                    <Flame className="text-orange-500" size={18} />
                    网络 Gas 概览 (Network Gas - Last 5 Blocks)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="bg-aave-dark/50 rounded-lg p-3 flex flex-col items-center justify-center border border-orange-500/30">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Latest</span>
                        <span className="text-lg font-bold text-orange-400">{gasData.latest.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500">Gwei</span>
                    </div>
                    <div className="bg-aave-dark/50 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-700/30">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Median</span>
                        <span className="text-lg font-bold text-white">{gasData.median.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500">Gwei</span>
                    </div>
                    <div className="bg-aave-dark/50 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-700/30">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Top 20% Avg</span>
                        <span className="text-lg font-bold text-red-400">{gasData.top20Avg.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500">Gwei</span>
                    </div>
                    <div className="bg-aave-dark/50 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-700/30">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Low 80% Avg</span>
                        <span className="text-lg font-bold text-green-400">{gasData.bottom80Avg.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500">Gwei</span>
                    </div>
                    <div className="bg-aave-dark/50 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-700/30">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Min</span>
                        <span className="text-lg font-bold text-gray-300">{gasData.min.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500">Gwei</span>
                    </div>
                    <div className="bg-aave-dark/50 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-700/30">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Max</span>
                        <span className="text-lg font-bold text-gray-300">{gasData.max.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500">Gwei</span>
                    </div>
                </div>
            </div>
        )}

        {/* Watch List Prices */}
        {watchListPrices.length > 0 && (
            <div className="animate-fade-in space-y-3 bg-[#1a1e30] border border-gray-700/50 rounded-2xl p-4 shadow-xl">
                 <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                    <Eye className="text-aave-secondary" size={18} />
                    市场价格监控 (Market Watch)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {watchListPrices.map((token) => (
                        <div key={token.symbol} className="bg-aave-dark/50 rounded-lg p-3 flex items-center justify-between border border-gray-700/30">
                            <span className="font-bold text-gray-200 pl-2">{token.symbol}</span>
                            <span className="font-mono text-aave-secondary font-bold">
                                ${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Wallet Balance Summary */}
        {walletBalances && walletBalances.totalValueUSD > 0 && <WalletBalanceCard data={walletBalances} />}

        {/* Global Summary */}
        {globalSummary.assetCount > 0 && (
            <div className="animate-fade-in space-y-3 bg-[#1a1e30] border border-gray-700/50 rounded-2xl p-4 shadow-xl relative overflow-hidden">
                 <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                    <Layers className="text-aave-secondary" />
                    质押汇总 (Staked Assets)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <DollarSign size={12} className="text-aave-secondary" /> 总持仓价值
                        </span>
                        <span className="text-xl font-bold text-white">
                            ${globalSummary.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp size={12} className="text-purple-400" /> 总区间收益
                        </span>
                        <span className="text-xl font-bold text-purple-400">
                            ${globalSummary.totalPeriodEarningsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                     <div className="flex flex-col">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Activity size={12} className="text-green-400" /> 总日均收益
                        </span>
                        <span className="text-xl font-bold text-green-400">
                            ${globalSummary.totalDailyEarningsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <PieChart size={12} className="text-aave-primary" /> 全局加权APY
                        </span>
                        <span className="text-xl font-bold text-aave-primary">
                            {(globalSummary.avgAPY * 100).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lido Summary */}
            {lidoSummary.assetCount > 0 && (
                <div className="animate-fade-in space-y-3 bg-[#131625] border border-blue-400/30 rounded-2xl p-4 shadow-xl">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Droplets className="text-blue-400" />
                        Lido (stETH) 汇总
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                        <StatsCard title="持仓价值" value={`$${lidoSummary.totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} color="text-blue-400" />
                        <StatsCard title="加权 APY" value={`${(lidoSummary.avgAPY * 100).toFixed(2)}%`} icon={PieChart} color="text-blue-400" />
                        <StatsCard title="区间收益" value={`$${lidoSummary.totalPeriodEarningsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={TrendingUp} color="text-purple-400" />
                        <StatsCard title="日均收益" value={`$${lidoSummary.totalDailyEarningsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={Activity} color="text-green-400" />
                    </div>
                </div>
            )}

            {/* Umbrella Summary */}
            {umbrellaSummary.assetCount > 0 && (
                <div className="animate-fade-in space-y-3 bg-[#131625] border border-aave-primary/30 rounded-2xl p-4 shadow-xl">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="text-aave-primary" />
                        Aave Umbrella 汇总
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                        <StatsCard title="总持仓价值" value={`$${umbrellaSummary.totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subValue={`${umbrellaSummary.assetCount} 个资产`} icon={DollarSign} color="text-aave-secondary" />
                        <StatsCard title="加权 APY" value={`${(umbrellaSummary.avgAPY * 100).toFixed(2)}%`} icon={PieChart} color="text-aave-primary" />
                        <StatsCard title="总区间收益" value={`$${umbrellaSummary.totalPeriodEarningsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={TrendingUp} color="text-purple-400" />
                        <StatsCard title="总日均收益" value={`$${umbrellaSummary.totalDailyEarningsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={Activity} color="text-green-400" />
                    </div>
                </div>
            )}
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 gap-4">
            {discoveredAssets.map((asset) => {
                const result = results[asset.address];
                const isLido = asset.symbol === 'stETH';
                
                if (!result) return (
                    // Loading Skeleton
                    <div key={asset.address} className="animate-pulse bg-[#131625] border border-gray-700/50 rounded-2xl p-6 h-[400px] flex items-center justify-center">
                        <div className="text-center space-y-3">
                             <Loader2 className="animate-spin mx-auto text-aave-secondary" size={32} />
                             <p className="text-gray-500 text-sm">正在加载 {asset.symbol} 数据...</p>
                        </div>
                    </div>
                );

                return (
                    <div key={asset.address} className="animate-fade-in space-y-3 bg-[#131625] border border-gray-700/50 rounded-2xl p-4 shadow-xl relative">
                        <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2">
                            <h2 className="text-md font-bold text-white flex items-center gap-2">
                                {isLido ? <Droplets className="text-blue-400" /> : <Coins className="text-aave-secondary" />}
                                {asset.name}
                            </h2>
                            <span className="text-xs px-2 py-1 rounded border bg-green-500/10 border-green-500/30 text-green-400">
                                Active ({days} Days)
                            </span>
                        </div>

                        {/* Top Stats - 4 Columns Now */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatsCard 
                                title="质押份额 (Shares)" 
                                value={result.onChainData?.currentBalance.toFixed(2) || "0.00"}
                                subValue={result.onChainData?.symbol}
                                icon={Layers}
                                color="text-gray-400"
                            />
                            <StatsCard 
                                title="持仓价值 (Value)" 
                                value={`${(result.onChainData?.currentUnderlyingValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                subValue={asset.underlyingSymbol}
                                icon={ShieldCheck}
                                color={isLido ? "text-blue-400" : "text-aave-secondary"}
                            />
                            {/* New Card: Period Earnings */}
                            <StatsCard 
                                title={`区间收益 (${days}d)`} 
                                value={`${(result.stats.periodEarnings || 0).toFixed(4)}`}
                                subValue={asset.underlyingSymbol}
                                icon={TrendingUp}
                                color="text-purple-400"
                            />
                            <StatsCard 
                                title="周期年化 (Period APY)" 
                                value={`${(result.stats.apy * 100).toFixed(2)}%`}
                                subValue="Based on Avg"
                                icon={Activity}
                                color="text-green-400"
                            />
                        </div>

                        {/* Chart */}
                        <div className="bg-aave-dark/50 rounded-xl p-2 h-[280px]">
                            <h3 className="text-xs font-semibold text-gray-400 mb-1 px-2">收益构成详情 ({isLido ? "Lido Rebase" : "Lending"} + Rewards)</h3>
                            <EarningsChart data={result.earnings} />
                        </div>
                    </div>
                );
            })}
        </div>
        
        {/* Empty State */}
        {discoveredAssets.length === 0 && !loading && !error && (
             <div className="text-center py-12 opacity-50">
                 <ShieldCheck size={48} className="mx-auto text-gray-600 mb-4" />
                 <p className="text-gray-500">请在上方输入钱包地址以分析 Umbrella 或 Lido 头寸。</p>
             </div>
        )}

        {/* Debug Logs */}
        <section className="mt-12">
            <LogPanel logs={logs} onClear={() => setLogs([])} />
        </section>

      </main>
    </div>
  );
};

export default App;
