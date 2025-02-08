import { ethers } from 'ethers';
import { CCIP_ADDRESS } from './env.js';

const ccip_domain = {
  name: 'Farcaster name verification',
  version: '1',
  chainId: 1,
  verifyingContract: CCIP_ADDRESS,
};

const types = {
  DataProof: [
    { name: 'data', type: 'bytes' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'owner', type: 'address' },
  ],
};

export async function generateCCIPSignature(
  functionResult: `0x${string}`,
  timestamp: number,
  owner: string,
  signer: ethers.Signer
) {
  const dataProof = {
    data: functionResult,
    timestamp,
    owner: owner,
  };

  const signature = await signer.signTypedData(ccip_domain, types, dataProof);
  return signature;
}

export function verifyCCIPSignature(
  functionResult: `0x${string}`,
  timestamp: number,
  owner: `0x${string}`,
  signature: string,
  signerAddress: string
) {
  const dataProof = {
    data: functionResult,
    timestamp,
    owner: owner,
  };
  const signer = ethers.verifyTypedData(ccip_domain, types, dataProof, signature);
  return signer.toLowerCase() === signerAddress.toLowerCase();
}
