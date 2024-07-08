import { ethers } from 'ethers';
import { CCIP_ADDRESS, WARPCAST_ADDRESS } from './env.js';
import * as process from 'process';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

export const signer = ethers.Wallet.fromPhrase(
  process.env.MNEMONIC || 'test test test test test test test test test test test junk'
);
export const signerAddress = signer.address;
export const signerFid = parseInt(process.env.FID || '14045');

type KeyToFid = {
  [key: number]: string;
};

export const ADMIN_KEYS: KeyToFid = {
  [signerFid]: signerAddress, // FName server
  14046: WARPCAST_ADDRESS, // Warpcast backend
};

const hub_domain = {
  name: 'Farcaster name verification',
  version: '1',
  chainId: 1,
  // TODO: When changing, remember to also update on the backend!
  verifyingContract: '0xe3be01d99baa8db9905b33a3ca391238234b79d1', // name registry contract, will be the farcaster ENS CCIP contract later
} as const;
const ccip_domain = {
  name: 'Farcaster name verification',
  version: '1',
  chainId: 1,
  verifyingContract: CCIP_ADDRESS,
};
const types = {
  UserNameProof: [
    { name: 'name', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'owner', type: 'address' },
  ],
};

export async function generateSignature(userName: string, timestamp: number, owner: string, signer: ethers.Signer) {
  const userNameProof = {
    name: userName,
    timestamp,
    owner: owner,
  };
  return Buffer.from((await signer.signTypedData(hub_domain, types, userNameProof)).replace(/^0x/, ''), 'hex');
}

export async function generateCCIPSignature(userName: string, timestamp: number, owner: string, signer: ethers.Signer) {
  const userNameProof = {
    name: userName,
    timestamp,
    owner: owner,
  };
  return Buffer.from((await signer.signTypedData(ccip_domain, types, userNameProof)).replace(/^0x/, ''), 'hex');
}

export async function verifySignature(
  userName: string,
  timestamp: number,
  owner: string,
  signature: string,
  signerAddress: string
) {
  const userNameProof = {
    name: userName,
    timestamp,
    owner: owner,
  };

  const client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  const verifyResult = await client.verifyTypedData({
    domain: hub_domain,
    types: types,
    message: userNameProof,
    primaryType: 'UserNameProof',
    signature: signature as `0x${string}`,
    address: signerAddress as `0x${string}`,
  });

  return verifyResult;
}

export function verifyCCIPSignature(
  userName: string,
  timestamp: number,
  owner: string,
  signature: string,
  signerAddress: string
) {
  const userNameProof = {
    name: userName,
    timestamp,
    owner: owner,
  };
  const signer = ethers.verifyTypedData(ccip_domain, types, userNameProof, signature);
  return signer.toLowerCase() === signerAddress.toLowerCase();
}
