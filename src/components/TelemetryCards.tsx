import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Zap, Globe2 } from 'lucide-react';
import { TelemetryData } from '../types';

interface TelemetryCardsProps {
  telemetry: TelemetryData;
  isConnected: boolean;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry, isConnected }) => {
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto select-none">
      {/* Download Speed Pill */}
      <div className="h-[68px] bg-[#141824]/70 backdrop-blur-md border border-white/5 rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate">Download</p>
            <p className="text-sm font-bold text-white font-mono tabular-nums leading-tight mt-0.5 flex items-baseline">
              <span>{isConnected ? telemetry.downloadSpeedMbps.toFixed(1) : '0.0'}</span>
              <span className="text-[9px] text-gray-400 font-normal ml-1">MB/s</span>
            </p>
          </div>
        </div>
      </div>

      {/* Upload Speed Pill */}
      <div className="h-[68px] bg-[#141824]/70 backdrop-blur-md border border-white/5 rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate">Upload</p>
            <p className="text-sm font-bold text-white font-mono tabular-nums leading-tight mt-0.5 flex items-baseline">
              <span>{isConnected ? telemetry.uploadSpeedMbps.toFixed(1) : '0.0'}</span>
              <span className="text-[9px] text-gray-400 font-normal ml-1">MB/s</span>
            </p>
          </div>
        </div>
      </div>

      {/* Latency Pill */}
      <div className="h-[64px] bg-[#141824]/70 backdrop-blur-md border border-white/5 rounded-2xl px-3.5 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate">Ping Latency</p>
            <p className="text-xs font-bold text-white font-mono tabular-nums leading-tight mt-0.5 flex items-baseline">
              <span>{isConnected ? telemetry.latencyMs : '--'}</span>
              <span className="text-[9px] text-gray-400 font-normal ml-1">ms</span>
            </p>
          </div>
        </div>
      </div>

      {/* Masked IP Pill */}
      <div className="h-[64px] bg-[#141824]/70 backdrop-blur-md border border-white/5 rounded-2xl px-3.5 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Globe2 className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate">Virtual IP</p>
            <p className="text-xs font-semibold text-white font-mono leading-tight mt-0.5 truncate">
              {isConnected ? telemetry.publicIp : 'Hidden'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
