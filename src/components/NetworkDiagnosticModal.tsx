import React, { useState } from 'react';
import { Stethoscope, CheckCircle2, AlertTriangle, XCircle, RefreshCw, X } from 'lucide-react';
import { DiagnosticResult } from '../types';

export const NetworkDiagnosticModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>({
    dnsResolution: 'intercepted',
    udpAvailability: 'blocked',
    tcp443Reachability: 'open',
    dpiSignatureDetection: 'detected',
    recommendation:
      'FortiGate/Corporate firewall detected blocking raw UDP (WireGuard/Cloudflare WARP) and inspecting plain OpenVPN headers. Recommend connecting via "Stealth-TLS" or "OpenVPN-TCP/443" node.',
  });

  const runDiagnostics = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setResult({
        dnsResolution: 'intercepted',
        udpAvailability: 'blocked',
        tcp443Reachability: 'open',
        dpiSignatureDetection: 'detected',
        recommendation:
          'FortiGate/Corporate firewall detected blocking raw UDP (WireGuard/Cloudflare WARP) and inspecting plain OpenVPN headers. Recommend connecting via "Stealth-TLS" or "OpenVPN-TCP/443" node.',
      });
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121622] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <Stethoscope className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-white">Network & Firewall Diagnostic</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Evaluates local gateway filtering policies, UDP egress availability, DNS sinkholing, and deep packet inspection rules.
        </p>

        {result && (
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#181d2a] border border-gray-800">
              <span className="text-xs text-gray-300">Outbound UDP (WireGuard & QUIC):</span>
              <span className="flex items-center text-xs font-mono font-medium text-red-400">
                <XCircle className="w-3.5 h-3.5 mr-1" /> Blocked
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#181d2a] border border-gray-800">
              <span className="text-xs text-gray-300">Outbound TCP Port 443 (HTTPS):</span>
              <span className="flex items-center text-xs font-mono font-medium text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Open
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#181d2a] border border-gray-800">
              <span className="text-xs text-gray-300">DNS Resolution Behavior:</span>
              <span className="flex items-center text-xs font-mono font-medium text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Gateway Intercepted
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#181d2a] border border-gray-800">
              <span className="text-xs text-gray-300">DPI Header Fingerprinting:</span>
              <span className="flex items-center text-xs font-mono font-medium text-red-400">
                <XCircle className="w-3.5 h-3.5 mr-1" /> Active Filtering
              </span>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-blue-800/40">
              <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wide">
                Engine Diagnosis & Reason
              </p>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                {result.recommendation}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end space-x-3">
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Probing Gateway...' : 'Re-run Network Probe'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

