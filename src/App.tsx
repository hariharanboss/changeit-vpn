import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Lock, 
  Wifi, 
  Terminal,
  FileCode
} from 'lucide-react';
import { DEFAULT_PROFILES } from './constants/servers';
import { VpnProfile, ConnectionState, TelemetryData } from './types';
import { ConnectButton } from './components/ConnectButton';
import { TelemetryCards } from './components/TelemetryCards';
import { ServerSelector } from './components/ServerSelector';
import { NetworkDiagnosticModal } from './components/NetworkDiagnosticModal';

export const App: React.FC = () => {
  const [profiles] = useState<VpnProfile[]>(DEFAULT_PROFILES);
  const [selectedProfile, setSelectedProfile] = useState<VpnProfile>(DEFAULT_PROFILES[0]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Real-time telemetry simulation
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    bytesIn: 0,
    bytesOut: 0,
    downloadSpeedMbps: 0,
    uploadSpeedMbps: 0,
    latencyMs: selectedProfile.ping,
    uptimeSeconds: 0,
    publicIp: '185.220.101.45',
  });

  const [logs, setLogs] = useState<string[]>([
    '[INIT] OpenTunnel Desktop v1.0.0 (Windows x64)',
    '[WINTUN] Wintun L3 ring-buffer driver loaded.',
    '[WFP] Windows Filtering Platform kill-switch engine ready.',
    '[DNS] Windows NRPT leak protection subsystem armed.',
  ]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-19), `[${timestamp}] ${msg}`]);
  };

  // Toggle Connection Handler
  const handleToggleConnection = () => {
    if (connectionState === 'connected') {
      setConnectionState('disconnecting');
      addLog(`Terminating session with ${selectedProfile.name}...`);
      setTimeout(() => {
        setConnectionState('disconnected');
        addLog('Tunnel interface released. Routes restored to physical gateway.');
        setTelemetry((prev) => ({
          ...prev,
          downloadSpeedMbps: 0,
          uploadSpeedMbps: 0,
          uptimeSeconds: 0,
        }));
      }, 1000);
    } else {
      setConnectionState('connecting');
      addLog(`Initiating handshake with ${selectedProfile.endpoint}:${selectedProfile.port} (${selectedProfile.protocol})...`);
      
      setTimeout(() => {
        if (killSwitchEnabled) {
          addLog('[WFP] Enforcing persistent out-of-tunnel blocking filter.');
        }
        addLog('[NRPT] Binding wildcard namespace (.) to encrypted tunnel DNS 1.1.1.1.');
        addLog(`[TUN] Wintun interface established. Session encrypted with ChaCha20-Poly1305.`);
        setConnectionState('connected');
      }, 1800);
    }
  };

  // Telemetry tick
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const dl = parseFloat((Math.random() * 35 + 40).toFixed(1));
        const ul = parseFloat((Math.random() * 12 + 8).toFixed(1));
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
    <div className="min-h-screen flex flex-col bg-[#0b0e14] text-gray-200">
      {/* Top Application Bar */}
      <header className="h-14 border-b border-gray-800/80 px-6 flex items-center justify-between bg-[#10141d]/90 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <span>OpenTunnel Desktop</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">
                v1.0.0
              </span>
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#181d28] hover:bg-[#202736] border border-gray-800 text-gray-300 hover:text-white transition-colors"
          >
            <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
            <span>Firewall Probe</span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#181d28] hover:bg-[#202736] border border-gray-800 text-gray-300 hover:text-white transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Profile Generator</span>
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Connection & Telemetry */}
        <section className="lg:col-span-7 flex flex-col items-center">
          {/* Main Big Dial */}
          <ConnectButton
            state={connectionState}
            onToggle={handleToggleConnection}
          />

          {/* Quick Status Bar */}
          <div className="w-full mb-4 flex items-center justify-between px-4 py-2 rounded-xl bg-[#131722] border border-gray-800/80 text-xs">
            <div className="flex items-center space-x-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-emerald-500 animate-ping'
                    : connectionState === 'connecting'
                    ? 'bg-amber-500'
                    : 'bg-gray-600'
                }`}
              />
              <span className="text-gray-300">
                Mode:{' '}
                <strong className="text-white font-mono">{selectedProfile.protocol}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={killSwitchEnabled}
                  onChange={(e) => setKillSwitchEnabled(e.target.checked)}
                  className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0"
                />
                <span className="text-gray-300">WFP Kill Switch</span>
              </label>
            </div>
          </div>

          {/* Real-time Telemetry Data Cards */}
          <TelemetryCards
            telemetry={telemetry}
            isConnected={connectionState === 'connected'}
          />

          {/* Real-time Engine Console Log */}
          <div className="w-full mt-4 bg-[#11141c] border border-gray-800/80 rounded-xl p-3 flex flex-col flex-1 min-h-[140px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800/50">
              <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>Tunnel Engine Diagnostics</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Live IPC</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] text-gray-400">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Server Selection & Profiles */}
        <section className="lg:col-span-5 flex flex-col space-y-4">
          <ServerSelector
            profiles={profiles}
            selectedProfile={selectedProfile}
            onSelect={(p) => {
              setSelectedProfile(p);
              addLog(`Switched target profile to ${p.name}`);
            }}
            disabled={connectionState !== 'disconnected'}
          />

          {/* Compatibility Advisor Card */}
          <div className="bg-[#131722] border border-blue-900/30 rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide flex items-center space-x-1.5 mb-2">
              <Wifi className="w-3.5 h-3.5" />
              <span>Campus / Restrictive Wi-Fi Mode</span>
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              If campus firewalls (e.g. FortiGate/Palo Alto) block UDP and reject standard WireGuard handshakes, switch to <strong>Stealth-TLS (Port 443)</strong> or <strong>OpenVPN-TCP</strong>. These wrap tunneling frames inside standard TLS sessions identical to web traffic.
            </p>
          </div>
        </section>
      </main>

      {/* Network Diagnostic Modal */}
      <NetworkDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
      />

      {/* Profile Export Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">WireGuard & Stealth Configuration</h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="mt-4 p-3 bg-black/50 border border-gray-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto">
{`[Interface]
PrivateKey = aAAA...exampleKey=
Address = 10.14.0.2/32
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = bBBB...serverKey=
Endpoint = ${selectedProfile.endpoint}:${selectedProfile.port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`}
            </pre>
            <p className="text-xs text-gray-400 mt-3">
              Standard format compliant with Wintun, official WireGuard for Windows, and OpenTunnel desktop engine.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
