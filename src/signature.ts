import { ethers } from 'ethers';

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

export async function generateSignature(userName: string, timestamp: number, owner: string, signer: ethers.Signer) {
    const userNameProof = {
        name: userName,
        timestamp,
        owner
    }
    return await signer.signTypedData(domain, types, userNameProof);
}

export function verifySignature(userName: string, timestamp: number, owner: string, signature: string, signerAddress: string) {
    const userNameProof = {
        name: userName,
        timestamp,
        owner
    }
    const signer = ethers.verifyTypedData(domain, types, userNameProof, signature);
    return signer.toLowerCase() === signerAddress.toLowerCase();
}