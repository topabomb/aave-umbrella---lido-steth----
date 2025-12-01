
import React, { useRef, useEffect, useState } from 'react';
import { Terminal, XCircle, CheckCircle, Info, Network, Filter, Trash2 } from 'lucide-react';
import { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
  onClear?: () => void;
}

const LogPanel: React.FC<LogPanelProps> = ({ logs, onClear }) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Set<LogEntry['type']>>(new Set(['info', 'success', 'error', 'network']));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, filter]);

  const toggleFilter = (type: LogEntry['type']) => {
    const newFilter = new Set(filter);
    if (newFilter.has(type)) {
      newFilter.delete(type);
    } else {
      newFilter.add(type);
    }
    setFilter(newFilter);
  };

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

  const filteredLogs = logs.filter(log => filter.has(log.type));

  // Helper to highlight key parts like [Category] or $Values
  const formatMessage = (msg: string) => {
      // Highlight [Category]
      const categoryMatch = msg.match(/^(\[[a-zA-Z]+\])(.*)/);
      if (categoryMatch) {
          return (
              <span>
                  <span className="text-aave-secondary font-bold">{categoryMatch[1]}</span>
                  {categoryMatch[2]}
              </span>
          );
      }
      return msg;
  };

  return (
    <div className="bg-[#0A0C16] border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[300px]">
      <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Terminal size={16} className="text-aave-secondary" />
            <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest hidden sm:inline">区块链交互日志 (Blockchain Log)</span>
            <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest sm:hidden">Log</span>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="flex bg-gray-800 rounded-lg p-0.5">
                {(['info', 'success', 'network', 'error'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => toggleFilter(type)}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${filter.has(type) ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        title={`Toggle ${type}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
            {onClear && (
                <button onClick={onClear} className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Clear Logs">
                    <Trash2 size={14} />
                </button>
            )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[10px] md:text-xs">
        {filteredLogs.length === 0 && (
          <div className="text-gray-600 italic text-center mt-10">
              {logs.length > 0 ? "No logs match current filter." : "暂无日志。请开始分析以查看交互过程。"}
          </div>
        )}
        {filteredLogs.map((log, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-gray-800/30 pb-1 last:border-0 hover:bg-white/5 p-1 rounded transition-colors group">
            <span className="text-gray-600 shrink-0 select-none w-16 opacity-50 group-hover:opacity-100 transition-opacity">{log.timestamp}</span>
            <div className="mt-0.5 shrink-0">{getIcon(log.type)}</div>
            <span className={`break-all ${getColor(log.type)}`}>{formatMessage(log.message)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default LogPanel;