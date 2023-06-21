import {getDbClient, migrateToLatest} from "../src/db";
import {log} from "../src/log";
import {sql} from "kysely";
import {getCurrentUsername, getLatestTransfer} from "../src/transfers";
import {createTestTransfer, currentTimestamp} from "./utils";
import {generateSignature, signer, signerAddress, signerFid} from "../src/signature";
import {ethers} from "ethers";

const db = await getDbClient();
const owner = signerAddress;
const anotherSigner = ethers.Wallet.createRandom();

beforeAll(async () => {
    await migrateToLatest(db, log);
    await sql`TRUNCATE TABLE transfers RESTART IDENTITY`.execute(db);
    await createTestTransfer(db, {username: 'test123', to: 1});
    await createTestTransfer(db, {username: 'test123', from: 1, to: 2, timestamp: currentTimestamp() + 10});
});

describe('transfers', () => {
    describe(('createTransfer'), () => {
        test('should throw error if validation fails', async () => {
            await expect(createTestTransfer(db, {username: 'test123', to: 1})).rejects.toThrow('USERNAME_TAKEN');
        });

    });

    describe(('validateTransfer'), () => {
        test('cannot register an existing name', async () => {
            await expect(createTestTransfer(db, {username: 'test123', to: 1})).rejects.toThrow('USERNAME_TAKEN');
        });

        xtest('same fid cannot register twice', async () => {
            // TODO: fix
            await expect(createTestTransfer(db, {username: 'test1234', to: 2})).rejects.toThrow('TOO_MANY_NAMES');
        });

        test('cannot unregister a nonexistent name', async () => {
            await expect(createTestTransfer(db, {username: 'nonexistent', from: 1, to: 0})).rejects.toThrow('USERNAME_NOT_FOUND');
        });

        test('cannot transfer a nonexistent name', async () => {
            await expect(createTestTransfer(db, {username: 'non-existent', from: 1, to: 2})).rejects.toThrow('USERNAME_NOT_FOUND');
        });

        test('fails for an invalid signature', async () => {
            let now = currentTimestamp();
            // different name than signed type
            await expect(createTestTransfer(db, {
                username: 'differentname',
                to: 5,
                timestamp: now,
                user_signature: await generateSignature('aname', now, owner, signer)
            })).rejects.toThrow('INVALID_SIGNATURE');

            // different timestamp than signed type
            await expect(createTestTransfer(db, {
                username: 'aname',
                to: 5,
                timestamp: now + 1,
                user_signature: await generateSignature('aname', now, owner, signer)
            })).rejects.toThrow('INVALID_SIGNATURE');

            // different owner than signed type
            await expect(createTestTransfer(db, {
                username: 'aname',
                to: 5,
                timestamp: now,
                owner: anotherSigner.address,
                user_signature: await generateSignature('aname', now, owner, signer)
            })).rejects.toThrow('INVALID_SIGNATURE');
        });

        test('only allows admin fids to transfer', async () => {
            let now = currentTimestamp();

            // FID is not an admin, rejected
            await expect(createTestTransfer(db, {
                username: 'name',
                to: 5,
                owner: anotherSigner.address,
                user_fid: 1,
            })).rejects.toThrow('UNAUTHORIZED');

            // Fid is an admin, but signature doesn't match known public key, rejected
            await expect(createTestTransfer(db, {
                username: 'name',
                to: 5,
                owner: anotherSigner.address,
                user_fid: signerFid,
                user_signature: await generateSignature('name', now, owner, signer)
            })).rejects.toThrow('INVALID_SIGNATURE');
        });
    });

    describe(('getLatestTransfer'), () => {
        test('should return the latest transfer', async () => {
            const latest = await getLatestTransfer('test123', db);
            expect(latest).toBeDefined();
            expect(latest!.username).toBe('test123');
            expect(latest!.from).toBe(1);
            expect(latest!.to).toBe(2);
        });
        test('returns undefined if no transfer', async () => {
            const latest = await getLatestTransfer('nonexistent', db);
            expect(latest).toBeUndefined();
        });
    });

    describe(('getCurrentUsernames'), () => {
        // TODO: Fix this test (no easy way to get current list of names)
        xtest('should return the current usernames', async () => {
            const username_for_1 = await getCurrentUsername(1, db);
            expect(username_for_1).toBeUndefined();
            const username_for_2 = await getCurrentUsername(2, db);
            expect(username_for_2?.username).toBe('test123');
        });
    });
});