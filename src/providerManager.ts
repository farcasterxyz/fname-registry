import { FallbackProvider, AlchemyProvider, InfuraProvider, EtherscanProvider } from 'ethers';
import {
  GOERLI_ALCHEMY_SECRET,
  MAINNET_ALCHEMY_SECRET,
  INFURA_PROJECT_ID,
  INFURA_PROJECT_SECRET,
  ETHERSCAN_API_SECRET,
} from './env.js';
import { EthereumChain } from './util.js';

let availableProviders: Map<EthereumChain, FallbackProvider>;

// For HTTP providers: How many providers have to agree for us to trust the result?
const QUORUM = 2;

/**
 * Manages creation of web3 provider instances for a given network
 * (Goerli, Mainnet, etc.) and type (HTTPS or WebSocket).
 *
 * The returned providers are designed to be more fault tolerant if one of the
 * underlying providers (e.g. Alchemy, Infura, etc.) is down by using a
 * FallbackProvider with appropriate quorum.
 */
export class ProviderManager {
  static getProvider(chain: EthereumChain): FallbackProvider {
    if (!availableProviders) {
      this._init();
    }

    const provider = availableProviders.get(chain);

    if (!provider) {
      throw Error(`No provider found for chain: ${chain}`);
    }

    return provider;
  }

  private static _init() {
    availableProviders = new Map<EthereumChain, FallbackProvider>();

    availableProviders.set(
      EthereumChain.Goerli,
      new FallbackProvider(
        [
          {
            provider: new AlchemyProvider('goerli', GOERLI_ALCHEMY_SECRET),
            priority: 1,
            stallTimeout: 5000,
            weight: 1,
          },
          {
            provider: new InfuraProvider('goerli', INFURA_PROJECT_ID, INFURA_PROJECT_SECRET),
            priority: 2,
            stallTimeout: 5000,
            weight: 1,
          },
          {
            provider: new EtherscanProvider('goerli', ETHERSCAN_API_SECRET),
            priority: 3,
            stallTimeout: 5000,
            weight: 1,
          },
        ],
        QUORUM
      )
    );

    availableProviders.set(
      EthereumChain.Mainnet,
      new FallbackProvider(
        [
          {
            provider: new AlchemyProvider('homestead', MAINNET_ALCHEMY_SECRET),
            priority: 1,
            stallTimeout: 5000,
            weight: 1,
          },
          {
            provider: new InfuraProvider('homestead', INFURA_PROJECT_ID, INFURA_PROJECT_SECRET),
            priority: 2,
            stallTimeout: 5000,
            weight: 1,
          },
          {
            provider: new EtherscanProvider('homestead', ETHERSCAN_API_SECRET),
            priority: 3,
            stallTimeout: 5000,
            weight: 1,
          },
        ],
        QUORUM
      )
    );
  }
}
