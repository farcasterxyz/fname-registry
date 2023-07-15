import * as dotenv from 'dotenv';

dotenv.config();

export const ENVIRONMENT = process.env['ENVIRONMENT'] || 'dev';
export const SERVICE = process.env['DD_SERVICE'] || 'fname-registry';

export const GOERLI_ALCHEMY_SECRET = process.env['GOERLI_ALCHEMY_SECRET'] || '';
if (GOERLI_ALCHEMY_SECRET === '') {
  throw new Error('GOERLI_ALCHEMY_SECRET missing from .env');
}

export const WARPCAST_ADDRESS = process.env['WARPCAST_ADDRESS'] || '';
if (WARPCAST_ADDRESS === '') {
  throw new Error('WARPCAST_ADDRESS missing from .env');
}

// Address of the ENS CCIP verifier contract
export const CCIP_ADDRESS = process.env['CCIP_ADDRESS'] || '';
if (WARPCAST_ADDRESS === '') {
  throw new Error('CCIP_ADDRESS missing from .env');
}

export const ID_REGISTRY_ADDRESS = process.env['ID_REGISTRY_ADDRESS'] || '0xDA107A1CAf36d198B12c16c7B6a1d1C795978C42';
