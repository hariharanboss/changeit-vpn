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

  // Theme colors inspired by GalaxyBrain "informationOS"
  const wireframeStroke = isConnected
    ? 'rgba(16, 185, 129, 0.65)'
    : isConnecting
    ? 'rgba(255, 89, 64, 0.85)' // Cyber coral-orange from the pin
    : 'rgba(59, 130, 246, 0.3)';

  const wireframeGlow = isConnected
    ? 'rgba(16, 185, 129, 0.35)'
    : isConnecting
    ? 'rgba(255, 89, 64, 0.45)'
    : 'rgba(59, 130, 246, 0.15)';

  return (
    <div className="flex flex-col items-center justify-center my-3">
      {/* Central Interactive Dial & 3D Wireframe Orb */}
      <div className="relative flex items-center justify-center">
        
        {/* Ambient Halo behind Wireframe */}
        <div
          className={`absolute w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            isConnected
              ? 'bg-emerald-500/15'
              : isConnecting
              ? 'bg-[#ff5940]/20 animate-pulse'
              : 'bg-blue-600/10'
          }`}
        />

        {/* 3D Polygon Wireframe Mesh (GalaxyBrain Sci-Fi aesthetic) */}
        <div className="absolute -inset-5 pointer-events-none flex items-center justify-center">
          <svg
            className={`w-64 h-64 transition-all duration-1000 ${
              isConnecting
                ? 'animate-[spin_6s_linear_infinite]'
                : isConnected
                ? 'animate-[spin_30s_linear_infinite]'
                : 'animate-[spin_60s_linear_infinite]'
            }`}
            viewBox="0 0 256 256"
            fill="none"
          >
            <defs>
              <filter id="wireframe-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer Geodesic / Polygon Contour Lines */}
            <g stroke={wireframeStroke} strokeWidth="1" filter="url(#wireframe-glow)">
              {/* Outer polygon ring */}
              <polygon
                points="128,16 184,32 224,72 240,128 224,184 184,224 128,240 72,224 32,184 16,128 32,72 72,32"
                strokeDasharray={isConnecting ? '4 3' : 'none'}
                opacity={isConnecting ? 0.9 : 0.6}
              />
              
              {/* Inner isometric faceted chords */}
              <line x1="128" y1="16" x2="224" y2="184" opacity="0.35" />
              <line x1="184" y1="32" x2="128" y2="240" opacity="0.35" />
              <line x1="224" y1="72" x2="72" y2="224" opacity="0.35" />
              <line x1="240" y1="128" x2="32" y2="184" opacity="0.35" />
              <line x1="224" y1="184" x2="32" y2="72" opacity="0.35" />
              <line x1="184" y1="224" x2="72" y2="32" opacity="0.35" />
              <line x1="128" y1="240" x2="128" y2="16" opacity="0.25" />
              <line x1="72" y1="224" x2="184" y2="32" opacity="0.35" />
              <line x1="32" y1="184" x2="224" y2="72" opacity="0.35" />
              <line x1="16" y1="128" x2="240" y2="128" opacity="0.25" />
              <line x1="32" y1="72" x2="224" y2="184" opacity="0.35" />
              <line x1="72" y1="32" x2="184" y2="224" opacity="0.35" />

              {/* Concentric Wireframe Orbit */}
              <circle cx="128" cy="128" r="98" strokeDasharray="6 8" opacity="0.4" />
            </g>

            {/* Glowing Mesh Vertex Points */}
            <g fill={wireframeStroke}>
              <circle cx="128" cy="16" r="2.5" />
              <circle cx="184" cy="32" r="2.5" />
              <circle cx="224" cy="72" r="2.5" />
              <circle cx="240" cy="128" r="2.5" />
              <circle cx="224" cy="184" r="2.5" />
              <circle cx="184" cy="224" r="2.5" />
              <circle cx="128" cy="240" r="2.5" />
              <circle cx="72" cy="224" r="2.5" />
              <circle cx="32" cy="184" r="2.5" />
              <circle cx="16" cy="128" r="2.5" />
              <circle cx="32" cy="72" r="2.5" />
              <circle cx="72" cy="32" r="2.5" />
            </g>
          </svg>
        </div>

        {/* Counter-rotating Secondary Sci-Fi Grid Ring */}
        <div className="absolute -inset-4 pointer-events-none flex items-center justify-center">
          <svg
            className={`w-60 h-60 transition-all duration-1000 ${
              isConnecting
                ? 'animate-[spin_10s_linear_infinite_reverse]'
                : 'animate-[spin_45s_linear_infinite_reverse]'
            }`}
            viewBox="0 0 240 240"
            fill="none"
          >
            <circle
              cx="120"
              cy="120"
              r="108"
              stroke={wireframeGlow}
              strokeWidth="1.2"
              strokeDasharray="2 12"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Main Dial Housing Ring */}
        <div
          className={`w-48 h-48 rounded-full p-2.5 transition-all duration-500 flex items-center justify-center relative z-10 ${
            isConnected
              ? 'bg-gradient-to-tr from-emerald-600/30 via-emerald-400/10 to-teal-400/30 border border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.3)]'
              : isConnecting
              ? 'bg-gradient-to-tr from-[#ff5940]/30 via-[#ff7b5a]/15 to-orange-500/20 border border-[#ff5940]/50 shadow-[0_0_35px_rgba(255,89,64,0.35)]'
              : 'bg-[#151924]/80 border border-white/10 shadow-inner'
          }`}
        >
          {/* Main Interactive Button */}
          <button
            onClick={onToggle}
            disabled={isConnecting}
            className={`w-full h-full rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-2xl relative overflow-hidden group ${
              isConnected
                ? 'bg-gradient-to-b from-[#11241f] to-[#0c1915] border border-emerald-400/40 text-emerald-300'
                : isConnecting
                ? 'bg-gradient-to-b from-[#2a1411] to-[#1c0d0a] border border-[#ff5940]/50 text-[#ff7b5a] cursor-wait'
                : 'bg-gradient-to-b from-[#1c2230] to-[#121620] border border-white/10 text-gray-400 hover:text-white hover:border-blue-500/40 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]'
            }`}
          >
            {/* Soft inner radial sheen */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60 pointer-events-none" />

            <div
              className={`p-3.5 rounded-full mb-1.5 transition-transform duration-300 group-hover:scale-110 ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isConnecting
                  ? 'bg-[#ff5940]/25 text-[#ff7b5a]'
                  : 'bg-white/5 text-gray-300'
              }`}
            >
              <Power className="w-7 h-7 stroke-[2.5]" />
            </div>

            <span className="text-xs font-bold tracking-widest uppercase text-white/90">
              {isConnected ? 'DISCONNECT' : isConnecting ? 'HANDSHAKE...' : 'CONNECT'}
            </span>

            {isConnected ? (
              <span className="text-[11px] font-mono text-emerald-400/90 mt-0.5 font-semibold tracking-wider">
                {formatTime(uptimeSeconds)}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 mt-0.5 font-medium">
                {isConnecting ? 'Bridging TLS socket' : 'Tap to secure'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sci-Fi Connection Status Pill Badge */}
      <div
        className={`mt-4 px-3.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all ${
          isConnected
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : isConnecting
            ? 'bg-[#ff5940]/15 text-[#ff7b5a] border border-[#ff5940]/30'
            : 'bg-white/5 text-gray-400 border border-white/5'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected
              ? 'bg-emerald-400 animate-pulse'
              : isConnecting
              ? 'bg-[#ff5940] animate-ping'
              : 'bg-gray-500'
          }`}
        />
        <span className="text-[11px] font-mono">
          {isConnected
            ? 'Tunnel Active • AES-GCM 256'
            : isConnecting
            ? 'Negotiating TLS 1.3 Mesh'
            : 'Gateway Standby'}
        </span>
      </div>
    </div>
  );
};
