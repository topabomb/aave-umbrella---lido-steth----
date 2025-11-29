
import React from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DailyEarning } from '../types';

interface EarningsChartProps {
  data: DailyEarning[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-aave-dark border border-gray-700 p-3 rounded-lg shadow-xl text-xs">
        <p className="text-gray-300 mb-2 font-bold">{label} {data.isHistorical ? '(历史)' : '(预测)'}</p>
        
        <div className="space-y-1">
            <div className="flex justify-between gap-4">
                <span className="text-aave-secondary">Lending 收益 (价值增长):</span>
                <span className="text-white font-mono">{data.lendingEarnings.toFixed(5)}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-aave-primary">Safety 奖励 (AAVE):</span>
                <span className="text-white font-mono">{data.incentiveEarnings.toFixed(5)}</span>
            </div>
            <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between gap-4 font-bold">
                <span className="text-gray-400">单日总收益 (Total):</span>
                <span className="text-green-400 font-mono">{data.totalDailyYield.toFixed(5)}</span>
            </div>
             <div className="pt-2 mt-1 text-gray-500">
                持仓价值: ${data.underlyingValue.toFixed(2)}
            </div>
            <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between gap-4 font-bold">
                <span className="text-gray-400">当日年化 (Daily APY):</span>
                <span className="text-green-400 font-mono">{(data.dailyApy * 100).toFixed(2)}%</span>
            </div>
        </div>
      </div>
    );
  }
  return null;
};

const EarningsChart: React.FC<EarningsChartProps> = ({ data }) => {
  const chartData = data.slice(1);

  return (
    <div className="w-full h-[280px] mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2b3145" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#8E92A3" 
            tick={{fontSize: 11}} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            yAxisId="left"
            stroke="#8E92A3" 
            tick={{fontSize: 10}} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

          <Bar 
            yAxisId="left"
            dataKey="lendingEarnings" 
            name="Lending 收益 (底层增长)" 
            stackId="a" 
            fill="#2EBAC6" 
            barSize={20}
            radius={[0, 0, 4, 4]}
          />
          <Bar 
            yAxisId="left"
            dataKey="incentiveEarnings" 
            name="Umbrella 激励 (Rewards)" 
            stackId="a" 
            fill="#B6509E" 
            barSize={20}
            radius={[4, 4, 0, 0]}
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EarningsChart;
