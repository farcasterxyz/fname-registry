import {Kysely} from "kysely";
import {Database} from "./db.js";
import {generateSignature, signer} from "./signature.js";


type TransferRequest = {
    timestamp: number;
    username: string;
    owner: Uint8Array;
    from: number;
    to: number;
    user_signature?: Uint8Array;
}

type ValidTransfer = TransferRequest & {
    user_signature: Uint8Array;
    server_signature: Uint8Array;
}

type ErrorCode = 'USERNAME_TAKEN' | 'TOO_MANY_NAMES' | 'UNAUTHORIZED' | 'USERNAME_NOT_FOUND';
export class ValidationError extends Error {
    public readonly code: ErrorCode;
    constructor(code: ErrorCode) {
        super(`Validation error: ${code}`);
        this.code = code;
    }
}

export async function createTransfer(transferRequest: TransferRequest, db: Kysely<Database>) {
    await validateTransfer(transferRequest, db);
    const server_signature = await generateSignature(transferRequest.username, transferRequest.timestamp, transferRequest.owner, signer);
    // TODO: Allow empty user signature for admin transfers?
    const transfer: ValidTransfer = {...transferRequest, server_signature, user_signature: transferRequest.user_signature ?? server_signature};
    return await db.insertInto('transfers').values(transfer).executeTakeFirst();
}

export async function validateTransfer(transferRequest: TransferRequest, db: Kysely<Database>) {
    const existingTransfer = await getLatestTransfer(transferRequest.username, db);

    if (transferRequest.from === 0 ) {
        // Mint
        if (existingTransfer && existingTransfer.to !== 0) {
            throw new ValidationError('USERNAME_TAKEN');
        }

        if (await getCurrentUsername(transferRequest.to, db)) {
            throw new ValidationError('TOO_MANY_NAMES');
        }
    } else if (transferRequest.to === 0) {
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
    return db.selectFrom('transfers').selectAll().where('username', '=', name).orderBy('timestamp', 'desc').limit(1).executeTakeFirst();
}

export async function getCurrentUsername(fid: number, db: Kysely<Database>) {
    return db.selectFrom('transfers').select(['username']).where('to', '=', fid).orderBy('timestamp', 'desc').limit(1).executeTakeFirst();
}