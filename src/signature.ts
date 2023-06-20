import { ethers } from 'ethers';

export const signer = ethers.Wallet.fromPhrase(process.env.MNEMONIC || "test test test test test test test test test test test junk");
export const signerAddress = signer.address;

const domain = {
  name: 'Farcaster name verification',
  version: '1',
  chainId: 1,
  verifyingContract: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'  // Empty for now, will be the farcaster ENS CCIP contract later
};
const types = {
  UserNameProof: [
    { name: 'name', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'owner', type: 'address' }
  ]
};

export async function generateSignature(userName: string, timestamp: number, owner: Uint8Array, signer: ethers.Signer) {
  const userNameProof = {
    name: userName,
    timestamp,
    owner: '0x' + Buffer.from(owner).toString('hex'),
  };
  return Buffer.from((await signer.signTypedData(domain, types, userNameProof)).replace(/^0x/,''), 'hex');
}

export function verifySignature(userName: string, timestamp: number, owner: string, signature: Uint8Array, signerAddress: string) {
  const userNameProof = {
    name: userName,
    timestamp,
    owner
  }
  const signer = ethers.verifyTypedData(domain, types, userNameProof, '0x' + Buffer.from(signature).toString('hex'));
  return signer.toLowerCase() === signerAddress.toLowerCase();
}
