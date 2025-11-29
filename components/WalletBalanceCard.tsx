import React from 'react';
import { Wallet, DollarSign } from 'lucide-react';
import { WalletBalances, TokenBalance } from '../types';

interface WalletBalanceCardProps {
  data: WalletBalances;
}

const TokenIcon: React.FC<{ symbol: string }> = ({ symbol }) => {
  const Svg = () => {
    switch(symbol.toUpperCase()) {
      case 'ETH':
      case 'WETH':
        return <path d="M12 2l7 7-7 7-7-7 7-7zM6 12l6 6 6-6-6-6-6 6z" fill="#627EEA" />;
      case 'WBTC':
        return <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.17 14.43h-1.55l.62-2.35h-3.48l-.61 2.35h-1.55l3.29-8.86h1.5l3.28 8.86zm-1.84-3.72l-1.07-4.04-1.07 4.04h2.14z" fill="#F7931A" />;
      case 'USDC':
        return <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v8h-2v-8z" fill="#2775CA" />;
      case 'USDT':
        return <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-4h8v-2h-3v-2h3v-2h-3V8h-2v8z" fill="#50AF95" />;
      case 'DAI':
        return <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#F4B731" />;
      default:
        return <circle cx="12" cy="12" r="10" fill="#E5E7EB" />;
    }
  }
  return <svg width="24" height="24" viewBox="0 0 24 24" className="mr-3"><Svg /></svg>
};

const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({ data }) => {
  if (!data || data.balances.length === 0) {
    return null;
  }

  return (
    <div className="animate-fade-in space-y-3 bg-[#1a1e30] border border-gray-700/50 rounded-2xl p-4 shadow-xl">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Wallet className="text-green-400" />
        钱包余额 (Wallet Balances)
      </h3>
      <div className="flex items-baseline justify-between border-b border-gray-700 pb-2 mb-2">
        <span className="text-xs text-gray-400 uppercase">总价值</span>
        <span className="text-lg font-bold text-white">
          ${data.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {data.balances.map((token) => (
          <div key={token.symbol} className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-800/30 hover:bg-gray-800/60">
            <div className="flex items-center">
              <TokenIcon symbol={token.symbol} />
              <div className="flex flex-col">
                <span className="font-bold text-white">{token.symbol}</span>
                <span className="text-xs text-gray-400 font-mono">
                  @{token.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-white">{token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
              <p className="text-xs text-gray-500">${token.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WalletBalanceCard;
