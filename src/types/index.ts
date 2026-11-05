export type TunnelProtocol = 'WireGuard' | 'OpenVPN-TCP' | 'OpenVPN-UDP' | 'Stealth-TLS';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export interface VpnProfile {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  endpoint: string;
  port: number;
  protocol: TunnelProtocol;
  ping: number;
  isCustom?: boolean;
}

export interface TelemetryData {
  bytesIn: number;
  bytesOut: number;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
  latencyMs: number;
  uptimeSeconds: number;
  publicIp: string;
}

export interface DiagnosticResult {
  dnsResolution: 'ok' | 'failed' | 'intercepted';
  udpAvailability: 'open' | 'blocked' | 'throttled';
  tcp443Reachability: 'open' | 'blocked';
  dpiSignatureDetection: 'detected' | 'clean';
  recommendation: string;
}

