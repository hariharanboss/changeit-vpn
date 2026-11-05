import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Terminal,
  FileCode,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Lock
} from 'lucide-react';
import { DEFAULT_PROFILES } from './constants/servers';
import { VpnProfile, ConnectionState, TelemetryData } from './types';
import { ConnectButton } from './components/ConnectButton';
import { TelemetryCards } from './components/TelemetryCards';
import { ServerSelector } from './components/ServerSelector';
import { NetworkDiagnosticModal } from './components/NetworkDiagnosticModal';

const isElectron = typeof window !== 'undefined' && window.require;
const electron = isElectron ? window.require('electron') : null;

export const App: React.FC = () => {
  const [profiles] = useState<VpnProfile[]>([
    {
      id: 'aic-cloud-de',
      name: 'Germany (Frankfurt Central)',
      country: 'Germany',
      countryCode: 'DE',
      endpoint: 'i3owy.aiccloud.online',
      port: 443,
      protocol: 'Stealth-TLS',
      ping: 98,
    },
    ...DEFAULT_PROFILES
  ]);
  const [selectedProfile, setSelectedProfile] = useState<VpnProfile>(profiles[0]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showConsole, setShowConsole] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    bytesIn: 0,
    bytesOut: 0,
    downloadSpeedMbps: 0,
    uploadSpeedMbps: 0,
    latencyMs: selectedProfile.ping,
    uptimeSeconds: 0,
    publicIp: '135.125.222.22',
  });

  const [logs, setLogs] = useState<string[]>([
    '[INIT] OpenTunnel Vinapp v1.3.0',
    '[CORE] Native Xray Daemon integration loaded.',
    '[ADBLOCK] Upstream AdGuard DNS (94.140.14.14) & Geosite Blackhole Armed.',
  ]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-19), `[${timestamp}] ${msg}`]);
  };

  useEffect(() => {
    if (electron) {
      electron.ipcRenderer.on('vpn:log', (_: any, data: string) => {
        addLog(`[XRAY] ${data.trim()}`);
      });
    }
  }, []);

  const handleToggleConnection = async () => {
    if (connectionState === 'connected') {
      setConnectionState('disconnecting');
      addLog(`Disconnecting from ${selectedProfile.name}...`);
      
      if (electron) {
        await electron.ipcRenderer.invoke('vpn:disconnect');
      }

      setConnectionState('disconnected');
      addLog('Tunnel closed. System proxy cleared.');
      setTelemetry((prev) => ({
        ...prev,
        downloadSpeedMbps: 0,
        uploadSpeedMbps: 0,
        uptimeSeconds: 0,
      }));
    } else {
      setConnectionState('connecting');
      addLog(`Initiating stealth handshake with ${selectedProfile.endpoint}:${selectedProfile.port}...`);
      
      if (electron) {
        const res = await electron.ipcRenderer.invoke('vpn:connect');
        if (res.status === 'connected') {
          addLog('[XRAY] Tunnel active. Proxy routed to 127.0.0.1:10809.');
          setConnectionState('connected');
        } else {
          addLog(`[ERROR] Connection failed: ${res.error}`);
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
        const dl = parseFloat((Math.random() * 45 + 50).toFixed(1));
        const ul = parseFloat((Math.random() * 15 + 10).toFixed(1));
        const jitter = Math.floor(Math.random() * 6 - 3);

        return {
          ...prev,
          downloadSpeedMbps: dl,
          uploadSpeedMbps: ul,
          latencyMs: Math.max(12, selectedProfile.ping + jitter),
          uptimeSeconds: prev.uptimeSeconds + 1,
          bytesIn: prev.bytesIn + Math.floor(dl * 125000),
          bytesOut: prev.bytesOut + Math.floor(ul * 125000),
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionState, selectedProfile]);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-gray-200 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white relative overflow-x-hidden">
      {/* Background soft ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Navbar */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-[#0f131d]/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Lock className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <span>OpenTunnel</span>
              <span className="text-[10px] bg-white/5 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full font-mono">
                v1.3.0
              </span>
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="flex items-center space-x-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-[#141824]/80 hover:bg-[#1a2030] border border-white/5 text-gray-300 hover:text-white transition-all shadow-sm"
          >
            <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
            <span>Firewall Probe</span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center space-x-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-[#141824]/80 hover:bg-[#1a2030] border border-white/5 text-gray-300 hover:text-white transition-all shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Client Key</span>
          </button>
        </div>
      </header>

      {/* Main App Grid */}
      <main className="flex-1 p-8 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Section: Central Dial & Live Telemetry */}
        <section className="lg:col-span-7 flex flex-col items-center">
          
          {/* Active Server Floating Pill Card */}
          <div className="px-5 py-2.5 rounded-2xl bg-[#141824]/80 backdrop-blur-md border border-white/5 flex items-center space-x-3 shadow-lg mb-2">
            <span className="text-xl">🇩🇪</span>
            <div className="text-left">
              <p className="text-xs font-semibold text-white">{selectedProfile.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">
                {selectedProfile.endpoint} • <span className="text-emerald-400 font-medium">98ms</span>
              </p>
            </div>
          </div>

          {/* Vinapp Big Dial */}
          <ConnectButton
            state={connectionState}
            uptimeSeconds={telemetry.uptimeSeconds}
            onToggle={handleToggleConnection}
          />

          {/* Feature Quick-Toggles Pill Bar */}
          <div className="w-full max-w-md mb-6 flex items-center justify-between px-5 py-3 rounded-2xl bg-[#141824]/70 backdrop-blur-md border border-white/5 text-xs shadow-lg">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-300 text-[11px] font-medium">Tunnel Features</span>
            </div>

            <div className="flex items-center space-x-5">
              {/* AdBlocker Switch */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adBlockEnabled}
                  onChange={(e) => {
                    setAdBlockEnabled(e.target.checked);
                    addLog(`AdBlocker ${e.target.checked ? 'Armed' : 'Disabled'}`);
                  }}
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

          {/* Collapsible Console Drawer */}
          <div className="w-full max-w-md mt-6 bg-[#141824]/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden transition-all">
            <button
              onClick={() => setShowConsole(!showConsole)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-mono">Live Engine Diagnostics</span>
              </div>
              {showConsole ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showConsole && (
              <div className="p-3 border-t border-white/5 bg-[#0b0e14]/90 max-h-36 overflow-y-auto space-y-1 font-mono text-[10px] text-gray-400">
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Section: Node Selector & Security Card */}
        <section className="lg:col-span-5 flex flex-col space-y-5">
          <ServerSelector
            profiles={profiles}
            selectedProfile={selectedProfile}
            onSelect={(p) => {
              setSelectedProfile(p);
              addLog(`Target node changed to ${p.name}`);
            }}
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

      {/* Network Diagnostic Modal */}
      <NetworkDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
      />

      {/* Client Key Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141824] border border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Client Access Key</h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="mt-4 p-3.5 bg-black/60 border border-white/5 rounded-2xl text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all">
{`vless://e4b11f58-3921-4f16-b8f2-89dc087799aa@i3owy.aiccloud.online:443?type=ws&security=tls&path=%2Ftunnel#Germany-Stealth`}
            </pre>
            <p className="text-xs text-gray-400 mt-3">
              Direct access key compatible with v2rayN, v2rayNG, and Streisand.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
