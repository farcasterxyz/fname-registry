import { Kysely, Selectable } from 'kysely';
import { Database, TransfersTable } from './db.js';
import { ADMIN_KEYS, generateSignature, signer, verifySignature } from './signature.js';
import { bytesToHex, hexToBytes } from './util.js';
import { currentTimestamp } from './util.js';

const PAGE_SIZE = 100;
const TIMESTAMP_TOLERANCE = 60; // 1 minute

type TransferRequest = {
  timestamp: number;
  username: string;
  owner: string;
  from: number;
  to: number;
  userSignature: string;
  userFid: number;
};

export type TransferHistoryFilter = {
  fromTs?: number;
  fromId?: number;
  name?: string;
  fid?: number;
};

type ErrorCode =
  | 'USERNAME_TAKEN'
  | 'TOO_MANY_NAMES'
  | 'UNAUTHORIZED'
  | 'USERNAME_NOT_FOUND'
  | 'INVALID_SIGNATURE'
  | 'INVALID_TIMESTAMP';
export class ValidationError extends Error {
  public readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(`Validation error: ${code}`);
    this.code = code;
  }
}

export async function createTransfer(req: TransferRequest, db: Kysely<Database>) {
  await validateTransfer(req, db);
  const serverSignature = await generateSignature(req.username, req.timestamp, req.owner, signer);
  const transfer = {
    ...req,
    serverSignature,
    owner: hexToBytes(req.owner),
    userSignature: hexToBytes(req.userSignature),
  };
  return await db.insertInto('transfers').values(transfer).returning('id').executeTakeFirst();
}

export async function validateTransfer(req: TransferRequest, db: Kysely<Database>) {
  const verifierAddress = ADMIN_KEYS[req.userFid];
  if (!verifierAddress) {
    // Only admin transfers are allowed until we finish migrating
    throw new ValidationError('UNAUTHORIZED');
  }

  if (!verifySignature(req.username, req.timestamp, req.owner, req.userSignature, verifierAddress)) {
    throw new ValidationError('INVALID_SIGNATURE');
  }

  const existingTransfer = await getLatestTransfer(req.username, db);

  if (req.timestamp > currentTimestamp() + TIMESTAMP_TOLERANCE) {
    throw new ValidationError('INVALID_TIMESTAMP');
  }

  if (existingTransfer && existingTransfer.timestamp > req.timestamp) {
    throw new ValidationError('INVALID_TIMESTAMP');
  }

  if (req.from === 0) {
    // Mint
    if (existingTransfer && existingTransfer.to !== 0) {
      throw new ValidationError('USERNAME_TAKEN');
    }
  } else if (req.to === 0) {
    // Burn
    if (!existingTransfer || existingTransfer.to === 0) {
      throw new ValidationError('USERNAME_NOT_FOUND');
    }
  } else {
    // Transfer
    if (!existingTransfer) {
      throw new ValidationError('USERNAME_NOT_FOUND');
    }
  }
}

export async function getLatestTransfer(name: string, db: Kysely<Database>) {
  return db
    .selectFrom('transfers')
    .selectAll()
    .where('username', '=', name)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .executeTakeFirst();
}

export async function getCurrentUsername(fid: number, db: Kysely<Database>) {
  // TODO: We need a table of fids to usernames for this to work correctly
  return db
    .selectFrom('transfers')
    .select(['username'])
    .where('to', '=', fid)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .executeTakeFirst();
}

function toTransferResponse(row: Selectable<TransfersTable> | undefined) {
  if (!row) {
    return undefined;
  }
  return {
    id: row.id,
    timestamp: row.timestamp,
    username: row.username,
    owner: bytesToHex(row.owner),
    from: row.from,
    to: row.to,
    user_signature: bytesToHex(row.userSignature),
    server_signature: bytesToHex(row.serverSignature),
  };
}

export async function getTransferById(id: number, db: Kysely<Database>) {
  const row = await db.selectFrom('transfers').selectAll().where('id', '=', id).executeTakeFirst();
  return toTransferResponse(row);
}

export async function getTransferHistory(filterOpts: TransferHistoryFilter, db: Kysely<Database>) {
  let query = db.selectFrom('transfers').selectAll();
  if (filterOpts.fromId) {
    query = query.where('id', '>', filterOpts.fromId);
  }
  if (filterOpts.fromTs) {
    query = query.where('timestamp', '>', filterOpts.fromTs);
  }
  if (filterOpts.name) {
    query = query.where('username', '=', filterOpts.name);
  }
  if (filterOpts.fid) {
    const _fid = filterOpts.fid;
    query = query.where(({ or, cmpr }) => {
      return or([cmpr('from', '=', _fid), cmpr('to', '=', _fid)]);
    });
  }

  // If we're filtering by timestamp, we need to order by timestamp first because clients may use that as the high watermark
  if (filterOpts.fromTs) {
    query = query.orderBy('timestamp');
  }

  const res = await query.orderBy('id').limit(PAGE_SIZE).execute();
  return res.map(toTransferResponse);
}
