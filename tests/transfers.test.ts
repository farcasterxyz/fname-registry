import {getDbClient, migrateToLatest} from "../src/db";
import {signerAddress} from "../src/signature";
import {log} from "../src/log";
import {sql} from "kysely";
import {createTransfer, getCurrentUsername, getLatestTransfer} from "../src/transfers";

const db = await getDbClient();
const owner = Uint8Array.from(Buffer.from(signerAddress.slice(2), 'hex'));

beforeAll(async () => {
    await migrateToLatest(db, log);
    await sql`TRUNCATE TABLE transfers RESTART IDENTITY`.execute(db);
    await createTransfer({
        timestamp: Math.floor(Date.now()/1000),
        username: 'test123',
        from: 0,
        to: 1,
        owner,
    }, db);
    await createTransfer({
        timestamp: Math.floor(Date.now()/1000) + 10,
        username: 'test123',
        from: 1,
        to: 2,
        owner,
    }, db);
});

describe('transfers', () => {
    describe(('createTransfer'), () => {
        test('should thow error if validation fails', async () => {
            await expect(createTransfer({
                timestamp: Math.floor(Date.now()/1000),
                username: 'test123',
                from: 0,
                to: 1,
                owner,
            }, db)).rejects.toThrow('USERNAME_TAKEN');
        });

    });

    describe(('validateTransfer'), () => {
        test('cannot register an existing name', async () => {
            await expect(createTransfer({
                timestamp: Math.floor(Date.now()/1000),
                username: 'test123',
                from: 0,
                to: 1,
                owner,
            }, db)).rejects.toThrow('USERNAME_TAKEN');
        });

        test('same fid cannot register twice', async () => {
            await expect(createTransfer({
                timestamp: Math.floor(Date.now() / 1000),
                username: 'test1234',
                from: 0,
                to: 2,
                owner,
            }, db)).rejects.toThrow('TOO_MANY_NAMES');
        });

        test('cannot unregister a nonexistent name', async () => {
            await expect(createTransfer({
                timestamp: Math.floor(Date.now() / 1000),
                username: 'nonexistent',
                from: 1,
                to: 0,
                owner,
            }, db)).rejects.toThrow('USERNAME_NOT_FOUND');
        });

        test('cannot transfer a nonexistent name', async () => {
            await expect(createTransfer({
                timestamp: Math.floor(Date.now() / 1000),
                username: 'nonexistent',
                from: 1,
                to: 0,
                owner,
            }, db)).rejects.toThrow('USERNAME_NOT_FOUND');
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