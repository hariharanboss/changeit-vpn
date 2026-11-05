import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Zap, Globe2 } from 'lucide-react';
import { TelemetryData } from '../types';

interface TelemetryCardsProps {
  telemetry: TelemetryData;
  isConnected: boolean;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry, isConnected }) => {
  return (
    <div className="grid grid-cols-2 gap-3.5 w-full max-w-md mx-auto">
      {/* Download Speed Pill */}
      <div className="bg-[#141824]/70 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ArrowDownLeft className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Download</p>
            <p className="text-base font-bold text-white font-mono leading-tight">
              {isConnected ? telemetry.downloadSpeedMbps.toFixed(1) : '0.0'}
              <span className="text-[10px] text-gray-400 font-normal ml-1">Mbps</span>
            </p>
          </div>
        </div>
      </div>

      {/* Upload Speed Pill */}
      <div className="bg-[#141824]/70 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Upload</p>
            <p className="text-base font-bold text-white font-mono leading-tight">
              {isConnected ? telemetry.uploadSpeedMbps.toFixed(1) : '0.0'}
              <span className="text-[10px] text-gray-400 font-normal ml-1">Mbps</span>
            </p>
          </div>
        </div>
      </div>

      {/* Latency Pill */}
      <div className="bg-[#141824]/70 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl p-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Ping Latency</p>
            <p className="text-sm font-bold text-white font-mono leading-tight">
              {isConnected ? telemetry.latencyMs : '--'}
              <span className="text-[10px] text-gray-400 font-normal ml-1">ms</span>
            </p>
          </div>
        </div>
      </div>

      {/* Masked IP Pill */}
      <div className="bg-[#141824]/70 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl p-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Globe2 className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Virtual IP</p>
            <p className="text-xs font-semibold text-white font-mono truncate leading-tight">
              {isConnected ? telemetry.publicIp : 'Hidden'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
