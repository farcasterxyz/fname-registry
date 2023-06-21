import { ethers } from 'ethers';
import * as process from 'process';

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
  14046: '0xABba722926c8302c73e57A25AD8F63753904546f', // Warpcast backend
};

const domain = {
  name: 'Farcaster name verification',
  version: '1',
  chainId: 1,
  verifyingContract: '0xe3be01d99baa8db9905b33a3ca391238234b79d1', // name registry contract, will be the farcaster ENS CCIP contract later
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
  return Buffer.from((await signer.signTypedData(domain, types, userNameProof)).replace(/^0x/, ''), 'hex');
}

export function verifySignature(
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
  const signer = ethers.verifyTypedData(domain, types, userNameProof, signature);
  return signer.toLowerCase() === signerAddress.toLowerCase();
}
