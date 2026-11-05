import React from 'react';
import { Power } from 'lucide-react';
import { ConnectionState } from '../types';

interface ConnectButtonProps {
  state: ConnectionState;
  uptimeSeconds: number;
  onToggle: () => void;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({ state, uptimeSeconds, onToggle }) => {
  const isConnected = state === 'connected';
  const isConnecting = state === 'connecting' || state === 'disconnecting';

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center my-3">
      {/* Outer ambient glow circles */}
      <div className="relative flex items-center justify-center">
        {isConnected && (
          <>
            <div className="absolute w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl animate-pulse"></div>
            <div className="absolute w-52 h-52 rounded-full border border-emerald-500/20 animate-ping opacity-30"></div>
          </>
        )}
        {isConnecting && (
          <div className="absolute w-60 h-60 rounded-full bg-amber-500/15 blur-2xl animate-pulse"></div>
        )}

        {/* Decorative Ring */}
        <div className={`w-52 h-52 rounded-full p-2.5 transition-all duration-500 flex items-center justify-center ${
          isConnected 
            ? 'bg-gradient-to-tr from-emerald-600/30 via-emerald-400/10 to-teal-400/30 border border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.25)]'
            : isConnecting
            ? 'bg-gradient-to-tr from-amber-600/30 via-amber-400/10 to-orange-400/30 border border-amber-500/40'
            : 'bg-[#151924]/80 border border-white/5 shadow-inner'
        }`}>
          {/* Main Dial Button */}
          <button
            onClick={onToggle}
            disabled={isConnecting}
            className={`w-full h-full rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-2xl relative overflow-hidden group ${
              isConnected
                ? 'bg-gradient-to-b from-[#11241f] to-[#0c1915] border border-emerald-400/40 text-emerald-300'
                : isConnecting
                ? 'bg-gradient-to-b from-[#241f11] to-[#19150c] border border-amber-400/40 text-amber-300 cursor-wait'
                : 'bg-gradient-to-b from-[#1c2230] to-[#121620] border border-white/10 text-gray-400 hover:text-white hover:border-blue-500/40 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]'
            }`}
          >
            {/* Soft inner radial sheen */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60"></div>

            <div className={`p-4 rounded-full mb-2 transition-transform duration-300 group-hover:scale-110 ${
              isConnected ? 'bg-emerald-500/20 text-emerald-400' : isConnecting ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-gray-300'
            }`}>
              <Power className="w-8 h-8 stroke-[2.5]" />
            </div>

            <span className="text-xs font-bold tracking-widest uppercase text-white/90">
              {isConnected ? 'DISCONNECT' : isConnecting ? 'CONNECTING' : 'CONNECT'}
            </span>

            {isConnected ? (
              <span className="text-[11px] font-mono text-emerald-400/90 mt-1 font-semibold tracking-wider">
                {formatTime(uptimeSeconds)}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 mt-1 font-medium">
                {isConnecting ? 'Please wait...' : 'Tap to secure'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Connection Pill Status Badge */}
      <div className={`mt-5 px-3.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all ${
        isConnected
          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          : isConnecting
          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          : 'bg-white/5 text-gray-400 border border-white/5'
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-ping' : 'bg-gray-500'
        }`} />
        <span className="text-[11px]">
          {isConnected ? 'Connected & Protected' : isConnecting ? 'Establishing Tunnel' : 'Not Connected'}
        </span>
      </div>
    </div>
  );
};
