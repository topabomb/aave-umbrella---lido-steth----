
import { OnChainData } from "./types";

// Default Aave V3 Umbrella RewardsController
export const DEFAULT_REWARDS_CONTROLLER = '0x4655Ce3D625a63d30bA704087E52B4C31E38188B'; 

// Lido stETH Contract
export const LIDO_ADDRESS = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';

export const WATCH_LIST_TOKENS = {
    'ETH': { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, symbol: 'ETH' },
    'WETH': { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', decimals: 18, symbol: 'WETH' },
    'WBTC': { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8, symbol: 'WBTC' },
    'USDC': { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, symbol: 'USDC' },
    'USDT': { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, symbol: 'USDT' },
    'DAI': { address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18, symbol: 'DAI' },
};

export const ANALYSIS_OPTIONS = [
  { days: 7, label: '最近 7 天 (Last 7 Days)' },
  { days: 14, label: '最近 14 天 (Last 14 Days)' },
  { days: 30, label: '最近 30 天 (Last 30 Days)' },
  { days: 90, label: '最近 90 天 (Last 90 Days)' },
];

export const TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function REWARD_CONTROLLER() view returns (address)",
  "function getIncentivesController() view returns (address)"
];

export const ERC4626_ABI = [
  "function asset() view returns (address)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)"
];

// Lido Specific ABI
export const LIDO_ABI = [
  "function sharesOf(address _account) view returns (uint256)",
  "function getPooledEthByShares(uint256 _sharesAmount) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)"
];

// ABI for Aave V3 RewardsController
export const REWARDS_ABI = [
  // Asset List Discovery
  "function getAllAssets() view returns (address[])",
  "function getAssetsList() view returns (address[])",

  // View methods
  "function getAllUserRewards(address[] calldata assets, address user) external view returns (address[] memory rewardsList, uint256[] memory unclaimedAmounts)",
  "function getRewardsByAsset(address asset, address user) external view returns (address[] memory rewardsList, uint256[] memory unclaimedAmounts)",
  
  // The Simplified Calculation Method
  "function calculateCurrentUserRewards(address asset, address user) view returns (address[] memory rewardsList, uint256[] memory unclaimedAmounts)",

  // User Data (for debugging/verification if needed)
  "function getUserDataByAsset(address asset, address user) view returns (address[] memory rewardsList, tuple(uint128 index, uint128 accrued)[] memory userData)"
];

export const CHAINLINK_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)"
];

// Map Underlying Token Address -> Chainlink Feed Address (ETH Mainnet)
export const CHAINLINK_FEEDS: Record<string, string> = {
    // USDC -> USD
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    // USDT -> USD
    '0xdac17f958d2ee523a2206206994597c13d831ec7': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
    // DAI -> USD
    '0x6b175474e89094c44da98b954eedeac495271d0f': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
    // WETH -> USD
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    // WBTC -> USD
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    // stETH (Lido) -> uses ETH/USD feed usually, or stETH/USD. We map stETH address to ETH/USD feed for simplicity or stETH feed.
    // stETH / USD Chainlink Feed
    '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': '0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8', 
};

export const BLOCKS_PER_DAY = 7200; // Exact Ethereum PoS 12s per block (60*60*24 / 12 = 7200)
