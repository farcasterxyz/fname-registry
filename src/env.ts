import * as dotenv from 'dotenv';

dotenv.config();

export const ENVIRONMENT = process.env['ENVIRONMENT'] || 'dev';
export const SERVICE = process.env['DD_SERVICE'] || 'fname-registry';

export const OP_ALCHEMY_SECRET = process.env['OP_ALCHEMY_SECRET'] || '';
if (ENVIRONMENT === 'prod' && OP_ALCHEMY_SECRET === '') {
  console.log('env', ENVIRONMENT);
  throw new Error('OP_ALCHEMY_SECRET missing from .env');
}

export const WARPCAST_ADDRESS = process.env['WARPCAST_ADDRESS'] || '';
if (ENVIRONMENT === 'prod' && WARPCAST_ADDRESS === '') {
  throw new Error('WARPCAST_ADDRESS missing from .env');
}

// Address of the ENS CCIP verifier contract
export const CCIP_ADDRESS = process.env['CCIP_ADDRESS'] || '';
if (ENVIRONMENT === 'prod' && CCIP_ADDRESS === '') {
  throw new Error('CCIP_ADDRESS missing from .env');
}

export const ID_REGISTRY_ADDRESS = process.env['ID_REGISTRY_ADDRESS'] || '0x00000000fc6c5f01fc30151999387bb99a9f489b';

export const HUB_GRPC_URL = new URL(process.env['HUB_GRPC_URL'] || 'http://localhost:2281');
