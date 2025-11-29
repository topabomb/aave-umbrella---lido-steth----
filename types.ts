
export interface StakingStats {
  apy: number;
  totalStaked: string;
  priceUsd: number;
  lastUpdated: string;
  yieldBreakdown?: string;
  periodEarnings: number;
}

export interface DailyEarning {
  date: string;
  lendingEarnings: number; // Value Growth from Underlying (waToken appreciation)
  incentiveEarnings: number; // RewardsController Growth
  totalDailyYield: number;
  balance: number; // Staked Shares Balance
  underlyingValue: number; // Resolved USDC/USDT Value
  isHistorical: boolean;
  dailyApy: number;
}

export interface DiscoveredAsset {
  id: string; // Contract address
  name: string;
  symbol: string;
  address: string;
  underlyingSymbol: string;
}

export interface OnChainData {
  currentBalance: number; // Staked Shares
  currentUnderlyingValue: number; // Resolved USDC/USDT Value
  historicalData: { 
    block: number; 
    date: string; 
    balance: number; // Staked Shares
    underlyingValue: number; // Resolved USDC/USDT Value
    exchangeRate: number; // Underlying per Share
    rewards: number; 
  }[];
  totalSupply: number;
  blockNumber: number;
  symbol: string;
  name: string;
  contractAddress: string;
  id: string;
  usdPrice: number;
  underlyingAddress: string;
}

export interface AnalysisResult {
  stats: StakingStats;
  earnings: DailyEarning[];
  onChainData?: OnChainData;
}

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'network' | 'warn';
  message: string;
}

export type Logger = (message: string, type?: LogEntry['type']) => void;

export interface TokenBalance {
  symbol: string;
  balance: number;
  valueUSD: number;
  priceUSD: number;
}

export interface WalletBalances {
  balances: TokenBalance[];
  totalValueUSD: number;
}
