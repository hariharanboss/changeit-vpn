import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  SlidersHorizontal, 
  Lock,
  Sparkles
} from 'lucide-react';
import { DEFAULT_PROFILES } from './constants/servers';
import { VpnProfile, ConnectionState, TelemetryData } from './types';
import { ConnectButton } from './components/ConnectButton';
import { TelemetryCards } from './components/TelemetryCards';
import { ServerSelector } from './components/ServerSelector';

const isElectron = typeof window !== 'undefined' && window.require;
const electron = isElectron ? window.require('electron') : null;

export const App: React.FC = () => {
  const [profiles, setProfiles] = useState<VpnProfile[]>(DEFAULT_PROFILES);
  const [selectedProfile, setSelectedProfile] = useState<VpnProfile>(profiles[0]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    bytesIn: 0,
    bytesOut: 0,
    downloadSpeedMbps: 0,
    uploadSpeedMbps: 0,
    latencyMs: selectedProfile.ping,
    uptimeSeconds: 0,
    publicIp: 'Protected',
  });

  useEffect(() => {
    if (electron) {
      // 1. Fetch remote nodes
      electron.ipcRenderer.invoke('vpn:fetch-nodes').then((remoteNodes: VpnProfile[] | null) => {
        if (remoteNodes && remoteNodes.length > 0) {
          setProfiles(remoteNodes);
          setSelectedProfile(remoteNodes[0]);
        }
      }).catch(() => {});

      // 2. Check initial updater status
      electron.ipcRenderer.invoke('updater:get-status').then((res: { ready: boolean; version: string } | null) => {
        if (res && res.ready) {
          setUpdateInfo({ version: res.version });
        }
      }).catch(() => {});

      // 3. Listen for OTA update download completion
      const handleUpdateReady = (_event: any, data: { version: string }) => {
        if (data && data.version) {
          setUpdateInfo({ version: data.version });
        }
      };

      electron.ipcRenderer.on('updater:ready', handleUpdateReady);
      return () => {
        electron.ipcRenderer.removeListener('updater:ready', handleUpdateReady);
      };
    }
  }, []);

  const handleToggleConnection = async () => {
    if (connectionState === 'connected') {
      setConnectionState('disconnecting');
      
      if (electron) {
        await electron.ipcRenderer.invoke('vpn:disconnect');
      }

      setConnectionState('disconnected');
      setTelemetry((prev) => ({
        ...prev,
        downloadSpeedMbps: 0,
        uploadSpeedMbps: 0,
        uptimeSeconds: 0,
      }));
    } else {
      setConnectionState('connecting');
      
      if (electron) {
        const res = await electron.ipcRenderer.invoke('vpn:connect');
        if (res.status === 'connected') {
          setConnectionState('connected');
        } else {
          setConnectionState('error');
        }
      } else {
        setTimeout(() => {
          setConnectionState('connected');
        }, 1500);
      }
    }
  };

  useEffect(() => {
    if (connectionState !== 'connected') return;

    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const dl = parseFloat((Math.random() * 8 + 6.5).toFixed(1)); // in MB/s (MegaBytes)
        const ul = parseFloat((Math.random() * 2.5 + 1.8).toFixed(1)); // in MB/s (MegaBytes)
        const jitter = Math.floor(Math.random() * 6 - 3);

        return {
          ...prev,
          downloadSpeedMbps: dl,
          uploadSpeedMbps: ul,
          latencyMs: Math.max(12, selectedProfile.ping + jitter),
          uptimeSeconds: prev.uptimeSeconds + 1,
          bytesIn: prev.bytesIn + Math.floor(dl * 1024 * 1024),
          bytesOut: prev.bytesOut + Math.floor(ul * 1024 * 1024),
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionState, selectedProfile]);

  return (
    <div className="h-screen bg-[#0a0d14] text-gray-200 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* OTA Auto-Update Notification Banner */}
      {updateInfo && (
        <div className="bg-gradient-to-r from-blue-950/95 via-indigo-950/95 to-blue-950/95 border-b border-blue-500/40 px-8 py-2 flex items-center justify-between z-50 animate-in fade-in slide-in-from-top-2 shadow-lg">
          <div className="flex items-center space-x-2 text-xs text-blue-200">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Over-the-Air Update <strong>v{updateInfo.version}</strong> is ready to apply!</span>
          </div>
          <button
            onClick={() => electron?.ipcRenderer.invoke('updater:apply')}
            className="px-3.5 py-1 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-medium rounded-lg text-xs transition shadow-sm"
          >
            Restart to Update
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-14 px-8 flex items-center justify-between border-b border-white/5 bg-[#0f131d]/60 backdrop-blur-xl shrink-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Lock className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <span>ChangeIt</span>
              <span className="text-[10px] bg-white/5 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full font-mono">
                v1.3.1
              </span>
            </h1>
          </div>
        </div>
      </header>

      {/* Main App Grid */}
      <main className="flex-1 px-8 py-5 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start overflow-hidden">
        {/* Left Section: Central Dial & Live Telemetry */}
        <section className="lg:col-span-7 flex flex-col items-center">
          
          {/* Active Server Floating Pill Card */}
          <div className="px-5 py-2.5 rounded-2xl bg-[#141824]/80 backdrop-blur-md border border-white/5 flex items-center space-x-3 shadow-lg mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Shield className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-white">{selectedProfile.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">
                {selectedProfile.protocol} • <span className="text-emerald-400 font-medium">{selectedProfile.ping}ms</span>
              </p>
            </div>
          </div>

          {/* Big Dial */}
          <ConnectButton
            state={connectionState}
            uptimeSeconds={telemetry.uptimeSeconds}
            onToggle={handleToggleConnection}
          />

          {/* Feature Quick-Toggles Pill Bar */}
          <div className="w-full max-w-md mb-4 flex items-center justify-between px-5 py-2.5 rounded-2xl bg-[#141824]/70 backdrop-blur-md border border-white/5 text-xs shadow-lg">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-300 text-[11px] font-medium">Protection Features</span>
            </div>

            <div className="flex items-center space-x-5">
              {/* AdBlocker Switch */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adBlockEnabled}
                  onChange={(e) => setAdBlockEnabled(e.target.checked)}
                  className="rounded-full bg-gray-900 border-white/10 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-emerald-400 font-semibold text-[11px] flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>AdBlock</span>
                </span>
              </label>

              {/* Kill Switch */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={killSwitchEnabled}
                  onChange={(e) => setKillSwitchEnabled(e.target.checked)}
                  className="rounded-full bg-gray-900 border-white/10 text-blue-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-gray-300 text-[11px]">Kill Switch</span>
              </label>
            </div>
          </div>

          {/* Minimalist Floating Telemetry Cards */}
          <TelemetryCards
            telemetry={telemetry}
            isConnected={connectionState === 'connected'}
          />
        </section>

        {/* Right Section: Node Selector & Security Card */}
        <section className="lg:col-span-5 flex flex-col space-y-5">
          <ServerSelector
            profiles={profiles}
            selectedProfile={selectedProfile}
            onSelect={(p) => setSelectedProfile(p)}
            disabled={connectionState !== 'disconnected'}
          />

          {/* Vinapp Feature Shield Card */}
          <div className="bg-[#141824]/70 backdrop-blur-md border border-white/5 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Shield className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                  Stealth TLS Protection
                </h4>
                <p className="text-[11px] text-emerald-400 font-medium">Bypasses FortiGuard & Deep Packet Inspection</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mt-2">
              Your connection disguises encrypted VPN frames inside ordinary <strong>HTTPS/TLS 1.3 WebSockets</strong>. Institutional firewalls see only standard web traffic to a legitimate domain.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
