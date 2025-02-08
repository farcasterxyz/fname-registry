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
    { name: 'request', type: 'bytes32' },
    { name: 'result', type: 'bytes32' },
    { name: 'validUntil', type: 'uint256' },
  ],
};

export async function generateCCIPSignature(
  request: `0x${string}`,
  result: `0x${string}`,
  validUntil: number,
  signer: ethers.Signer
) {
  const dataProof = {
    request,
    result,
    validUntil,
  };

  const signature = await signer.signTypedData(ccip_domain, types, dataProof);
  return signature;
}

export function verifyCCIPSignature(
  request: `0x${string}`,
  result: `0x${string}`,
  validUntil: number,
  signature: string,
  signerAddress: string
) {
  const dataProof = {
    request,
    result,
    validUntil,
  };
  const signer = ethers.verifyTypedData(ccip_domain, types, dataProof, signature);
  return signer.toLowerCase() === signerAddress.toLowerCase();
}
