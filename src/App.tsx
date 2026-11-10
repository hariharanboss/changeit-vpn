import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  SlidersHorizontal, 
  Sparkles,
  AlertTriangle,
  X
} from 'lucide-react';
import { DEFAULT_PROFILES } from './constants/servers';
import { VpnProfile, ConnectionState, TelemetryData } from './types';
import { ConnectButton } from './components/ConnectButton';
import { TelemetryCards } from './components/TelemetryCards';

const isElectron = typeof window !== 'undefined' && window.require;
const electron = isElectron ? window.require('electron') : null;

interface ConnectionFailure {
  message: string;
  detail?: string;
  logPath?: string;
}

interface TunnelDiagnostics {
  coreRunning: boolean;
  listening: boolean;
  probeOk: boolean;
  probe: string;
  proxy: string;
  logPath: string;
}

const DiagnosticRow: React.FC<{ label: string; value: string; ok?: boolean }> = ({ label, value, ok }) => (
  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#181d2a] border border-gray-800">
    <span className="text-[11px] text-gray-300">{label}</span>
    <span className={`text-[11px] font-mono ${ok === undefined ? 'text-gray-400' : ok ? 'text-emerald-400' : 'text-red-400'}`}>
      {value}
    </span>
  </div>
);

export const App: React.FC = () => {
  const [profiles, setProfiles] = useState<VpnProfile[]>(DEFAULT_PROFILES);
  const [selectedProfile, setSelectedProfile] = useState<VpnProfile>(profiles[0]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(null);
  const [failure, setFailure] = useState<ConnectionFailure | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [diagnostics, setDiagnostics] = useState<TunnelDiagnostics | null>(null);
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

      const handleTunnelStatus = (_event: any, data: { status: string; error?: string }) => {
        if (data && data.status === 'disconnected') {
          setConnectionState('disconnected');
          setTelemetry((prev) => ({
            ...prev,
            downloadSpeedMbps: 0,
            uploadSpeedMbps: 0,
            uptimeSeconds: 0,
          }));
          if (data.error) setFailure({ message: data.error });
        }
      };

      electron.ipcRenderer.on('updater:ready', handleUpdateReady);
      electron.ipcRenderer.on('vpn:status', handleTunnelStatus);
      return () => {
        electron.ipcRenderer.removeListener('updater:ready', handleUpdateReady);
        electron.ipcRenderer.removeListener('vpn:status', handleTunnelStatus);
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
      setFailure(null);
      
      if (electron) {
        try {
          const res = await electron.ipcRenderer.invoke('vpn:connect');
          if (res.status === 'connected') {
            setConnectionState('connected');
            setFailure(null);
          } else {
            setConnectionState('error');
            setFailure({
              message: res.error || 'Connection failed.',
              detail: res.detail,
              logPath: res.logPath,
            });
          }
        } catch (err: any) {
          setConnectionState('error');
          setFailure({ message: `Connection failed: ${err?.message || err}` });
        }
      } else {
        setTimeout(() => {
          setConnectionState('connected');
        }, 1500);
      }
    }
  };

  const recheckTunnel = async () => {
    if (!electron) return;
    try {
      const res = await electron.ipcRenderer.invoke('vpn:diagnose');
      setDiagnostics(res);
    } catch (_) {}
  };

  const openDetails = () => {
    setShowDetails(true);
    recheckTunnel();
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
    <div className="h-screen w-screen bg-[#0a0d14] text-gray-200 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* OTA Auto-Update Notification Banner */}
      {updateInfo && (
        <div className="bg-gradient-to-r from-blue-950/95 via-indigo-950/95 to-blue-950/95 border-b border-blue-500/40 px-5 py-2 flex items-center justify-between z-50 animate-in fade-in slide-in-from-top-2 shadow-lg shrink-0">
          <div className="flex items-center space-x-2 text-xs text-blue-200">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Update <strong>v{updateInfo.version}</strong> ready!</span>
          </div>
          <button
            onClick={() => electron?.ipcRenderer.invoke('updater:apply')}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-medium rounded-lg text-xs transition shadow-sm"
          >
            Restart to Apply
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-white/5 bg-[#0f131d]/60 backdrop-blur-xl shrink-0 z-40">
        <div className="flex items-center space-x-3">
          <img 
            src="/icon.png" 
            alt="ChangeIt" 
            className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-blue-500/20 border border-white/10" 
          />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <span>ChangeIt</span>
              <span className="text-[10px] bg-white/5 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full font-mono">
                v1.5.6
              </span>
            </h1>
          </div>
        </div>

        {/* Status pill in header */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
          <span className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-300">
            {connectionState === 'connected' ? 'Protected' : 'Standby'}
          </span>
        </div>
      </header>

      {/* Connection failure banner */}
      {failure && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-950/70 backdrop-blur-xl px-5 py-2 z-40">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-red-200 leading-snug">{failure.message}</p>
              <div className="flex items-center space-x-3 mt-1">
                <button
                  onClick={openDetails}
                  className="text-[10px] font-semibold text-red-300 hover:text-white transition"
                >
                  Re-check
                </button>
                <button
                  onClick={() => electron?.ipcRenderer.invoke('vpn:open-logs')}
                  className="text-[10px] font-semibold text-red-300 hover:text-white transition"
                >
                  Open logs
                </button>
              </div>
            </div>
            <button
              onClick={() => setFailure(null)}
              aria-label="Dismiss"
              className="text-red-400/70 hover:text-white transition p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Centered Non-Scrolling Layout */}
      <main className="flex-1 px-5 py-3 max-w-sm w-full mx-auto flex flex-col items-center justify-between overflow-hidden">
        {/* Active Gateway Pill */}
        <div className="w-full px-4 py-2 rounded-2xl bg-[#141824]/80 backdrop-blur-md border border-white/5 flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Shield className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-white tracking-wide">{selectedProfile.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">
                Stealth-TLS Relay
              </p>
            </div>
          </div>
          <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-medium">
            {selectedProfile.ping}ms
          </div>
        </div>

        {/* Centered Dial */}
        <div className="my-auto py-1 flex items-center justify-center shrink-0">
          <ConnectButton
            state={connectionState}
            uptimeSeconds={telemetry.uptimeSeconds}
            onToggle={handleToggleConnection}
          />
        </div>

        {/* Protection Features Toggle Bar */}
        <div className="w-full flex items-center justify-between px-4 py-2 rounded-2xl bg-[#141824]/70 backdrop-blur-md border border-white/5 text-xs shadow-lg shrink-0 mb-2">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-300 text-[11px] font-medium">Protection</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* AdBlocker Switch */}
            <label className="flex items-center space-x-1.5 cursor-pointer">
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
            <label className="flex items-center space-x-1.5 cursor-pointer">
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

        {/* Floating Telemetry Cards */}
        <div className="w-full shrink-0">
          <TelemetryCards
            telemetry={telemetry}
            isConnected={connectionState === 'connected'}
          />
        </div>
      </main>

      {/* Connection diagnostics */}
      {showDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Connection diagnostics</h3>
              <button
                onClick={() => setShowDetails(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {failure && (
              <p className="text-xs text-red-300 mt-3 leading-relaxed">{failure.message}</p>
            )}

            <div className="mt-3 space-y-1.5">
              <DiagnosticRow
                label="Tunnel engine"
                value={diagnostics ? (diagnostics.coreRunning ? 'running' : 'not running') : 'checking...'}
                ok={diagnostics?.coreRunning}
              />
              <DiagnosticRow
                label={`Proxy port ${10809}`}
                value={diagnostics ? (diagnostics.listening ? 'listening' : 'not listening') : 'checking...'}
                ok={diagnostics?.listening}
              />
              <DiagnosticRow
                label="Traffic probe"
                value={diagnostics ? (diagnostics.probeOk ? 'passed' : 'failed') : 'checking...'}
                ok={diagnostics?.probeOk}
              />
              <DiagnosticRow label="System proxy" value={diagnostics?.proxy || '127.0.0.1:10809'} />
            </div>

            <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-black/40 border border-white/5 p-2 text-[10px] text-gray-400 whitespace-pre-wrap break-all">
              {diagnostics?.probe || failure?.detail || 'No extra details recorded.'}
            </pre>

            <p className="mt-2 text-[10px] text-gray-500 font-mono break-all">
              {diagnostics?.logPath || failure?.logPath || ''}
            </p>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={recheckTunnel}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 transition"
              >
                Re-run check
              </button>
              <button
                onClick={() => electron?.ipcRenderer.invoke('vpn:open-logs')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                Open log folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
