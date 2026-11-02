import React from 'react';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ConnectionState } from '../types';

interface ConnectButtonProps {
  state: ConnectionState;
  onToggle: () => void;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({ state, onToggle }) => {
  const isConnected = state === 'connected';
  const isConnecting = state === 'connecting' || state === 'disconnecting';

  return (
    <div className="flex flex-col items-center justify-center my-6">
      <div className="relative group">
        {/* Animated pulse ring when active */}
        {isConnected && (
          <div className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
        )}
        {isConnecting && (
          <div className="absolute -inset-2 bg-amber-500/20 rounded-full blur-xl animate-spin"></div>
        )}

        <button
          onClick={onToggle}
          disabled={isConnecting}
          className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-2xl border-2 ${
            isConnected
              ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 border-emerald-400/50 shadow-emerald-950/60'
              : isConnecting
              ? 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-400/50 shadow-amber-950/60 cursor-wait'
              : 'bg-gradient-to-b from-[#181d28] to-[#121620] border-gray-700/60 hover:border-gray-500 shadow-black'
          }`}
        >
          {isConnected ? (
            <ShieldCheck className="w-16 h-16 text-white mb-2" />
          ) : isConnecting ? (
            <ShieldAlert className="w-16 h-16 text-white mb-2 animate-bounce" />
          ) : (
            <Shield className="w-16 h-16 text-gray-400 group-hover:text-gray-200 transition-colors mb-2" />
          )}

          <span className="text-sm font-semibold tracking-wider uppercase text-white/90">
            {isConnected ? 'DISCONNECT' : isConnecting ? 'CONNECTING...' : 'CONNECT'}
          </span>
          <span className="text-xs text-white/60 font-mono mt-0.5">
            {isConnected ? 'TUNNEL ACTIVE' : isConnecting ? 'NEGOTIATING' : 'READY'}
          </span>
        </button>
      </div>
    </div>
  );
};
