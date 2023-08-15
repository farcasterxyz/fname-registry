import { AlchemyProvider } from 'ethers';
import { OP_ALCHEMY_SECRET, ID_REGISTRY_ADDRESS } from './env.js';
import { IdRegistry } from './abi/IdRegistry.js';
import { IdRegistry__factory } from './abi/index.js';

export function getIdRegistryContract(): IdRegistry {
  const provider = new AlchemyProvider('optimism', OP_ALCHEMY_SECRET);
  return IdRegistry__factory.connect(ID_REGISTRY_ADDRESS, provider);
}
