import React from 'react';
import { VpnProfile } from '../types';
import { Check, Zap } from 'lucide-react';

interface ServerSelectorProps {
  profiles: VpnProfile[];
  selectedProfile: VpnProfile;
  onSelect: (profile: VpnProfile) => void;
  disabled: boolean;
}

export const ServerSelector: React.FC<ServerSelectorProps> = ({
  profiles,
  selectedProfile,
  onSelect,
  disabled,
}) => {
  return (
    <div className="w-full bg-[#131722] border border-gray-800/80 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200 tracking-wide uppercase">
          Routing Nodes & Gateways
        </h3>
        <span className="text-xs text-gray-400 font-mono">
          {profiles.length} available
        </span>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {profiles.map((profile) => {
          const isSelected = selectedProfile.id === profile.id;

          return (
            <button
              key={profile.id}
              disabled={disabled}
              onClick={() => onSelect(profile)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-blue-600/10 border-blue-500/50 shadow-sm'
                  : 'bg-[#181d28]/60 border-gray-800/80 hover:bg-[#1a202d] hover:border-gray-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{getFlagEmoji(profile.countryCode)}</span>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs font-semibold text-white">{profile.name}</p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                        profile.protocol === 'Stealth-TLS'
                          ? 'bg-purple-900/60 text-purple-300 border border-purple-500/30'
                          : profile.protocol === 'WireGuard'
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-900/60 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {profile.protocol}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {profile.endpoint}:{profile.port}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-mono text-gray-300">{profile.ping}ms</span>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

function getFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
