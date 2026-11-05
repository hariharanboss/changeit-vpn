import { VpnProfile } from '../types';

export const DEFAULT_PROFILES: VpnProfile[] = [
  {
    id: 'de-frankfurt-stealth',
    name: 'Germany (Frankfurt Stealth Gateway)',
    country: 'Germany',
    countryCode: 'DE',
    endpoint: 'gateway.opentunnel.net',
    port: 443,
    protocol: 'Stealth-TLS',
    ping: 85,
  },
];
