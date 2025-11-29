
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: string;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, subValue, icon: Icon, color = "text-aave-secondary", className }) => {
  return (
    <div className={`bg-aave-card border border-gray-700/50 rounded-xl p-5 flex items-center justify-between shadow-lg hover:border-aave-secondary/30 transition-all duration-300 ${className}`}>
      <div className="overflow-hidden min-w-0">
        <p className="text-aave-muted text-xs font-medium mb-1 uppercase tracking-wider truncate">{title}</p>
        <h3 className="text-xl font-bold text-white truncate" title={String(value)}>{value}</h3>
        {subValue && <p className="text-[10px] text-gray-400 mt-1 truncate">{subValue}</p>}
      </div>
      <div className={`p-2.5 rounded-full bg-opacity-10 bg-gray-600 shrink-0 ml-3 ${color}`}>
        <Icon size={20} />
      </div>
    </div>
  );
};

export default StatsCard;