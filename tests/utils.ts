import {generateSignature, signer, signerAddress, signerFid} from "../src/signature";
import {createTransfer} from "../src/transfers";
import {Database} from "../src/db";
import {Kysely} from "kysely";
import {bytesToHex} from "../src/bytes";

type TestTransferParams = {
    username: string,
    from?: number,
    to: number,
    timestamp?: number,
    owner?: string,
    user_signature?: Uint8Array,
    user_fid?: number
};

export async function createTestTransfer(db: Kysely<Database>, opts: TestTransferParams) {
    opts.timestamp = opts.timestamp ?? currentTimestamp();
    opts.from = opts.from ?? 0;
    opts.owner = opts.owner ?? signerAddress;
    opts.user_signature = opts.user_signature ?? await generateSignature(opts.username, opts.timestamp, opts.owner, signer);
    return createTransfer({
        timestamp: opts.timestamp,
        username: opts.username,
        owner: opts.owner,
        from: opts.from,
        to: opts.to,
        user_signature: bytesToHex(opts.user_signature),
        user_fid: opts.user_fid ?? signerFid,
    }, db);
}

export function currentTimestamp(): number {
    return Math.floor(Date.now()/1000);
}