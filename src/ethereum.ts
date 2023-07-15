import { AlchemyProvider } from 'ethers';
import { GOERLI_ALCHEMY_SECRET, ID_REGISTRY_ADDRESS } from './env.js';
import { IdRegistry } from './abi/IdRegistry.js';
import { IdRegistry__factory } from './abi/index.js';

export function getIdRegistryContract(): IdRegistry {
  const provider = new AlchemyProvider('goerli', GOERLI_ALCHEMY_SECRET);
  return IdRegistry__factory.connect(ID_REGISTRY_ADDRESS, provider);
}
