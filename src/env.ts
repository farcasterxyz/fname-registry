import * as dotenv from 'dotenv';

dotenv.config();

export const ENVIRONMENT = process.env['ENVIRONMENT'] || 'dev';

export const GOERLI_ALCHEMY_SECRET = process.env['GOERLI_ALCHEMY_SECRET'] || '';
if (GOERLI_ALCHEMY_SECRET === '') {
  throw new Error('GOERLI_ALCHEMY_SECRET missing from .env');
}

export const MAINNET_ALCHEMY_SECRET = process.env['MAINNET_ALCHEMY_SECRET'] || '';
if (MAINNET_ALCHEMY_SECRET === '') {
  throw new Error('MAINNET_ALCHEMY_SECRET missing from .env');
}

export const ETHERSCAN_API_SECRET = process.env['ETHERSCAN_API_SECRET'] || '';
if (ETHERSCAN_API_SECRET === '') {
  throw new Error('ETHERSCAN_API_SECRET missing from .env');
}

export const INFURA_PROJECT_ID = process.env['INFURA_PROJECT_ID'] || '';
if (INFURA_PROJECT_ID === '') {
  throw new Error('INFURA_PROJECT_ID missing from .env');
}

export const INFURA_PROJECT_SECRET = process.env['INFURA_PROJECT_SECRET'] || '';
if (INFURA_PROJECT_SECRET === '') {
  throw new Error('INFURA_PROJECT_SECRET missing from .env');
}
