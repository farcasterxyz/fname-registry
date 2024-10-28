import { Kysely, Selectable } from 'kysely';
import { Database, TransfersTable } from './db.js';
import { ADMIN_KEYS, generateSignature, signer, verifySignature } from './signature.js';
import { reservedUsername } from './reserved.js';
import { bytesToHex, currentTimestamp, hexToBytes } from './util.js';
import { bytesCompare, validations } from '@farcaster/hub-nodejs';
import { log } from './log.js';
import { IdRegistry } from './abi/index.js';
import { toNumber } from 'ethers';

const PAGE_SIZE = 100;
export const TIMESTAMP_TOLERANCE = 10 * 60; // 5 minute
export const NAME_CHANGE_DELAY = 28 * 24 * 60 * 60; // 28 days in seconds

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
  | 'USERNAME_RESERVED'
  | 'TOO_MANY_NAMES'
  | 'UNAUTHORIZED'
  | 'USERNAME_NOT_FOUND'
  | 'INVALID_SIGNATURE'
  | 'INVALID_USERNAME'
  | 'INVALID_FID_OWNER'
  | 'THROTTLED'
  | 'INVALID_TIMESTAMP';
export class ValidationError extends Error {
  public readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(`Validation error: ${code}`);
    this.code = code;
  }
}

export async function createTransfer(req: TransferRequest, db: Kysely<Database>, idContract: IdRegistry) {
  const existing_matching_transfer_id = await validateTransfer(req, db, idContract);
  if (existing_matching_transfer_id) {
    return { id: existing_matching_transfer_id };
  }
  const serverSignature = await generateSignature(req.username, req.timestamp, req.owner, signer);
  const transfer = {
    ...req,
    serverSignature,
    owner: hexToBytes(req.owner),
    userSignature: hexToBytes(req.userSignature),
  };
  return await db.insertInto('transfers').values(transfer).returning('id').executeTakeFirst();
}

async function getAndValidateVerifierAddress(req: TransferRequest, idContract: IdRegistry) {
  // Admin transfer
  if (ADMIN_KEYS[req.userFid]) {
    return ADMIN_KEYS[req.userFid];
  }

  // For user transfers, make sure the userFid matches the transfer request if it's present and that the
  // owner address actually owns the fid
  let userFid = -1;
  if (req.from === 0) {
    userFid = req.to;
  } else if (req.to === 0) {
    userFid = req.from;
  }
  if (req.userFid && userFid !== req.userFid) {
    log.warn(`User FID ${req.userFid} does not match FID ${userFid} in transfer request`);
    throw new ValidationError('UNAUTHORIZED');
  }

  let ownerFid: bigint;

  try {
    ownerFid = await idContract.idOf(req.owner);
  } catch (e) {
    log.error(e, `Unable to get fid for owner: ${req.owner}`);
    throw new ValidationError('INVALID_FID_OWNER');
  }

  if (toNumber(ownerFid) !== userFid) {
    log.warn(`Owner for FID ${ownerFid.toString()} does not match owner ${req.owner} in transfer request`);
    throw new ValidationError('INVALID_FID_OWNER');
  }

  return req.owner;
}

export async function validateTransfer(req: TransferRequest, db: Kysely<Database>, idContract: IdRegistry) {
  const verifierAddress = await getAndValidateVerifierAddress(req, idContract);
  if (!verifierAddress) {
    throw new ValidationError('UNAUTHORIZED');
  }

  if (reservedUsername(req.username) && !ADMIN_KEYS[req.userFid]) {
    throw new ValidationError('USERNAME_RESERVED');
  }

  const verifySignatureResult = await verifySignature(
    req.username,
    req.timestamp,
    req.owner,
    req.userSignature,
    verifierAddress
  );

  if (!verifySignatureResult) {
    log.error(`Invalid signature for req ${JSON.stringify(req)}`);
    throw new ValidationError('INVALID_SIGNATURE');
  }

  const validationResult = validations.validateFname(req.username);
  if (validationResult.isErr()) {
    throw new ValidationError('INVALID_USERNAME');
  }

  const existingTransfer = await getLatestTransfer(req.username, db);

  const existingName = await getCurrentUsername(req.to, db);
  if (existingName) {
    if (
      existingTransfer &&
      existingName === req.username &&
      bytesCompare(hexToBytes(existingTransfer.owner), hexToBytes(req.owner)) === 0
    ) {
      return existingTransfer.id;
    }
    throw new ValidationError('TOO_MANY_NAMES');
  }

  const maxAcceptableTimestamp = currentTimestamp() + TIMESTAMP_TOLERANCE;
  if (req.timestamp > maxAcceptableTimestamp) {
    log.error(`Timestamp ${req.timestamp} was > ${maxAcceptableTimestamp}`);
    throw new ValidationError('INVALID_TIMESTAMP');
  }

  const minAcceptableTimestamp = currentTimestamp() - TIMESTAMP_TOLERANCE;
  if (req.timestamp < minAcceptableTimestamp) {
    log.error(`Timestamp ${req.timestamp} was < ${minAcceptableTimestamp}`);
    throw new ValidationError('INVALID_TIMESTAMP');
  }

  if (existingTransfer && existingTransfer.timestamp > req.timestamp) {
    log.error(`Timestamp ${req.timestamp} < previous transfer timestamp of ${existingTransfer.timestamp}`);
    throw new ValidationError('INVALID_TIMESTAMP');
  }

  // Non-admin users can only change their name once every 28 days
  if (existingTransfer && !ADMIN_KEYS[req.userFid] && req.timestamp < existingTransfer.timestamp + NAME_CHANGE_DELAY) {
    throw new ValidationError('THROTTLED');
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
  return toTransferResponse(
    await db
      .selectFrom('transfers')
      .selectAll()
      .where('username', '=', name)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .executeTakeFirst()
  );
}

export async function getCurrentUsername(fid: number, db: Kysely<Database>) {
  // fid 0 is the mint/burn address, so it can never have a username
  if (fid === 0) {
    return undefined;
  }
  // To get the current username, we need to get the most recent transfer and ensure the fid is the receiver
  const transfer = await db
    .selectFrom('transfers')
    .select(['username', 'from', 'to'])
    .where(({ or, eb }) => {
      return or([eb('from', '=', fid), eb('to', '=', fid)]);
    })
    .orderBy('timestamp', 'desc')
    .limit(1)
    .executeTakeFirst();

  // The most recent transfer to the fid is the current username. We have validations that ensure there can only be
  // one name per fid
  if (transfer && transfer.to === fid) {
    return transfer.username;
  } else {
    return undefined;
  }
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
    query = query.where(({ or, eb }) => {
      return or([eb('from', '=', _fid), eb('to', '=', _fid)]);
    });
  }

  // If we're filtering by timestamp, we need to order by timestamp first because clients may use that as the high watermark
  if (filterOpts.fromTs) {
    query = query.orderBy('timestamp');
  }

  const res = await query.orderBy('id').limit(PAGE_SIZE).execute();
  return res.map(toTransferResponse);
}
