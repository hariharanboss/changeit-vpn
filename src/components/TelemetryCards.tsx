import React from 'react';
import { ArrowDown, ArrowUp, Activity, Globe } from 'lucide-react';
import { TelemetryData } from '../types';

interface TelemetryCardsProps {
  telemetry: TelemetryData;
  isConnected: boolean;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry, isConnected }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
      {/* Download Speed */}
      <div className="bg-[#131722] border border-gray-800/80 rounded-xl p-3 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <ArrowDown className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Download</p>
          <p className="text-base font-semibold text-white font-mono">
            {isConnected ? telemetry.downloadSpeedMbps.toFixed(1) : '0.0'}{' '}
            <span className="text-xs text-gray-400 font-normal">Mbps</span>
          </p>
        </div>
      </div>

      {/* Upload Speed */}
      <div className="bg-[#131722] border border-gray-800/80 rounded-xl p-3 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <ArrowUp className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Upload</p>
          <p className="text-base font-semibold text-white font-mono">
            {isConnected ? telemetry.uploadSpeedMbps.toFixed(1) : '0.0'}{' '}
            <span className="text-xs text-gray-400 font-normal">Mbps</span>
          </p>
        </div>
      </div>

      {/* Latency */}
      <div className="bg-[#131722] border border-gray-800/80 rounded-xl p-3 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Latency</p>
          <p className="text-base font-semibold text-white font-mono">
            {isConnected ? telemetry.latencyMs : '--'}{' '}
            <span className="text-xs text-gray-400 font-normal">ms</span>
          </p>
        </div>
      </div>

      {/* Virtual IP */}
      <div className="bg-[#131722] border border-gray-800/80 rounded-xl p-3 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <Globe className="w-5 h-5" />
        </div>
        <div className="truncate">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Assigned IP</p>
          <p className="text-xs font-semibold text-white font-mono truncate">
            {isConnected ? telemetry.publicIp : 'Unassigned'}
          </p>
        </div>
      </div>
    </div>
  );
};
