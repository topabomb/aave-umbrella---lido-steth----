
import React, { useRef, useEffect } from 'react';
import { Terminal, XCircle, CheckCircle, Info, Network } from 'lucide-react';
import { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
}

const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return <XCircle size={14} className="text-red-500" />;
      case 'success': return <CheckCircle size={14} className="text-green-500" />;
      case 'network': return <Network size={14} className="text-blue-400" />;
      default: return <Info size={14} className="text-gray-500" />;
    }
  };

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-300';
      case 'success': return 'text-green-300';
      case 'network': return 'text-blue-300';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="bg-[#0A0C16] border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[300px]">
      <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-800 flex items-center gap-2">
        <Terminal size={16} className="text-aave-secondary" />
        <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">区块链交互日志 (Blockchain Log)</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px] md:text-xs">
        {logs.length === 0 && (
          <div className="text-gray-600 italic text-center mt-10">暂无日志。请开始分析以查看交互过程。<br/>No logs available. Start analysis to view interactions.</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-gray-800/30 pb-1 last:border-0 hover:bg-white/5 p-1 rounded transition-colors">
            <span className="text-gray-600 shrink-0 select-none w-16">{log.timestamp}</span>
            <div className="mt-0.5 shrink-0">{getIcon(log.type)}</div>
            <span className={`break-all ${getColor(log.type)}`}>{log.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default LogPanel;