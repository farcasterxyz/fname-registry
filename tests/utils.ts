import { generateSignature, signer, signerAddress, signerFid } from '../src/signature';
import { createTransfer } from '../src/transfers';
import { currentTimestamp } from '../src/util';
import { Database } from '../src/db';
import { Kysely } from 'kysely';
import { bytesToHex } from '../src/util';

type TestTransferParams = {
  username: string;
  from?: number;
  to: number;
  timestamp?: number;
  owner?: string;
  userSignature?: Uint8Array;
  userFid?: number;
};

export async function createTestTransfer(db: Kysely<Database>, opts: TestTransferParams) {
  opts.timestamp = opts.timestamp ?? currentTimestamp();
  opts.from = opts.from ?? 0;
  opts.owner = opts.owner ?? signerAddress;
  opts.userSignature =
    opts.userSignature ?? (await generateSignature(opts.username, opts.timestamp, opts.owner, signer));
  return createTransfer(
    {
      timestamp: opts.timestamp,
      username: opts.username,
      owner: opts.owner,
      from: opts.from,
      to: opts.to,
      userSignature: bytesToHex(opts.userSignature),
      userFid: opts.userFid ?? signerFid,
    },
    db
  );
}
