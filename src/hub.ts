import { AbiItem, encodeFunctionResult, zeroAddress } from 'viem';

import { HUB_GRPC_URL } from './env.js';
import { decodeEnsRequest, BASE_RESOLVER_ABI } from './util.js';

// ENS text record keys to support
const supportedKeys = ['avatar', 'description', 'url'] as const;
type SupportedKey = (typeof supportedKeys)[number];

/**
 *
 * @param fid
 * @param param1
 * @returns An object with the raw and encoded ENS record
 */
export async function getRecordFromHub(
  fid: number,
  { functionName, args }: NonNullable<ReturnType<typeof decodeEnsRequest>>
) {
  let result: string = '';

  if (functionName === 'addr') {
    const coinType = args[1] ?? 60n; // 60 is ETH (SLIP-0044)

    // Farcaster doesn't store different addresses per chain, so we'll assume all addresses are valid on all EVM chains
    // This checks if a request is for ETH or an L2 (ENSIP-11)
    if (coinType === 60n || coinType > 0x80000000) {
      result = await getEthAddressByFid(fid);
    } else {
      result = zeroAddress;
    }
  }

  if (functionName === 'text') {
    const key = args[1] as SupportedKey;

    // Only handle keys that hubs might have
    if (supportedKeys.includes(key)) {
      result = await getUserDataByFid(fid, key);
    }
  }

  // Find the correct ABI item for each function, otherwise `addr(node, coinType)` gets incorrectly encoded as `addr(node)`
  const abi: AbiItem | undefined = BASE_RESOLVER_ABI.find(
    (abi) => abi.name === functionName && abi.inputs.length === args.length
  );

  return {
    plain: result,
    // This is what the response of ENS resolve() looks like, and will ultimately be returned to the client
    response: encodeFunctionResult({
      abi: [abi],
      functionName,
      result,
    }),
  };
}

// TODO: figure out if all the types below can be imported from other Farcaster packages
// Or get GRPC working and connect to the client from @farcaster/hub-nodejs for strong types
type Protocol = 'PROTOCOL_ETHEREUM' | 'PROTOCOL_SOLANA';

type HttpVerificationsResponse = {
  messages: Array<{
    data: {
      type: string;
      fid: number;
      timestamp: number;
      network: string;
      verificationAddAddressBody: {
        address: string;
        claimSignature: string;
        blockHash: string;
        verificationType: number;
        chainId: number;
        protocol: Protocol;
        ethSignature: string;
      };
      verificationAddEthAddressBody: {
        address: string;
        claimSignature: string;
        blockHash: string;
        verificationType: number;
        chainId: number;
        protocol: Protocol;
        ethSignature: string;
      };
    };
    hash: string;
    hashScheme: string;
    signature: string;
    signatureScheme: string;
    signer: string;
  }>;
  nextPageToken: string;
};

async function getEthAddressByFid(fid: number) {
  const res = await fetch(HUB_GRPC_URL.origin + '/v1/verificationsByFid?fid=' + fid);
  const verifications = (await res.json()) as HttpVerificationsResponse;

  const ethVerifications = verifications.messages.filter(
    (m) => m.data?.verificationAddAddressBody?.protocol === 'PROTOCOL_ETHEREUM'
  );
  const ethAddress = ethVerifications[0]?.data?.verificationAddAddressBody?.address;
  return ethAddress ?? zeroAddress;
}

type HttpUserDataResponse = {
  messages: Array<{
    data: {
      type: string;
      fid: number;
      timestamp: number;
      network: string;
      userDataBody: {
        type: string;
        value: string;
      };
    };
    hash: string;
    hashScheme: string;
    signature: string;
    signatureScheme: string;
    signer: string;
  }>;
  nextPageToken: string;
};

const ensTextKeyToHubType: Record<SupportedKey, string> = {
  avatar: 'USER_DATA_TYPE_PFP',
  description: 'USER_DATA_TYPE_BIO',
  url: 'USER_DATA_TYPE_URL',
};

async function getUserDataByFid(fid: number, key: SupportedKey) {
  const hubType = ensTextKeyToHubType[key];
  const res = await fetch(HUB_GRPC_URL.origin + '/v1/userDataByFid?fid=' + fid);
  const json = (await res.json()) as HttpUserDataResponse;
  const message = json.messages.find((m) => m.data.userDataBody.type === hubType);
  return message?.data.userDataBody.value ?? '';
}
