import React from 'react';
import { VpnProfile } from '../types';
import { Check, Signal } from 'lucide-react';

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
    <div className="w-full bg-[#141824]/70 backdrop-blur-md border border-white/5 rounded-3xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-bold text-white tracking-wider uppercase">
            Select Location
          </h3>
          <p className="text-[11px] text-gray-400">Optimal stealth gateway nodes</p>
        </div>
        <span className="text-[11px] bg-white/5 border border-white/5 px-2.5 py-1 rounded-full text-gray-400 font-mono">
          {profiles.length} Nodes
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {profiles.map((profile) => {
          const isSelected = selectedProfile.id === profile.id;

          return (
            <button
              key={profile.id}
              disabled={disabled}
              onClick={() => onSelect(profile)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-blue-600/15 to-emerald-600/15 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'bg-[#181d2c]/60 border-white/5 hover:bg-[#1f2638] hover:border-white/10'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center space-x-3.5">
                <span className="text-2xl drop-shadow-sm">{getFlagEmoji(profile.countryCode)}</span>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs font-semibold text-white tracking-wide">{profile.name}</p>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-medium ${
                        profile.protocol === 'Stealth-TLS'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : profile.protocol === 'WireGuard'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {profile.protocol}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {profile.endpoint}:{profile.port}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 bg-black/20 px-2 py-1 rounded-lg border border-white/5">
                  <Signal className="w-3 h-3 text-emerald-400" />
                  <span className="text-[11px] font-mono text-gray-300">{profile.ping}ms</span>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-sm">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
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
