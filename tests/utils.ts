import { generateSignature, signer, signerAddress, signerFid } from '../src/signature.js';
import { createTransfer } from '../src/transfers.js';
import { currentTimestamp } from '../src/util.js';
import { Database } from '../src/db.js';
import { Kysely } from 'kysely';
import { bytesToHex } from '../src/util.js';
import { jest } from '@jest/globals';

type TestTransferParams = {
  username: string;
  from?: number;
  to: number;
  timestamp?: number;
  owner?: string;
  userSignature?: Uint8Array;
  userFid?: number;
};

export async function createTestTransfer(db: Kysely<Database>, opts: TestTransferParams, idOfOwner?: number) {
  opts.timestamp = opts.timestamp ?? currentTimestamp();
  opts.from = opts.from ?? 0;
  opts.owner = opts.owner ?? signerAddress;
  opts.userSignature =
    opts.userSignature ?? (await generateSignature(opts.username, opts.timestamp, opts.owner, signer));
  const userFid = opts.userFid ?? signerFid;
  const idRegistry = { idOf: jest.fn().mockReturnValue(Promise.resolve(idOfOwner || 0)) } as any;
  return createTransfer(
    {
      timestamp: opts.timestamp,
      username: opts.username,
      owner: opts.owner,
      from: opts.from,
      to: opts.to,
      userSignature: bytesToHex(opts.userSignature),
      userFid: userFid,
    },
    db,
    idRegistry as any
  );
}
