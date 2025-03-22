import { getWriteClient, migrateToLatest } from '../src/db.js';
import { log } from '../src/log.js';
import { sql } from 'kysely';
import { getCurrentUsername, getLatestTransfer, TIMESTAMP_TOLERANCE } from '../src/transfers.js';
import { currentTimestamp } from '../src/util.js';
import { createTestTransfer } from './utils.js';
import { generateSignature, signer, signerAddress, signerFid } from '../src/signature.js';
import { ethers } from 'ethers';

const db = getWriteClient();
const owner = signerAddress;
const anotherSigner = ethers.Wallet.createRandom();
const now = currentTimestamp();

beforeAll(async () => {
  await migrateToLatest(db, log);
  await sql`TRUNCATE TABLE transfers RESTART IDENTITY`.execute(db);
  
  // Création de transferts de test
  await createTestTransfer(db, { username: 'test123', to: 1 });
  await createTestTransfer(db, { username: 'test123', from: 1, to: 2, timestamp: now + 10 });
  await createTestTransfer(db, { username: 'test3', to: 3, timestamp: now - 2 });
});

describe('transfers', () => {
  describe('validateTransfer', () => {
    test.each([
      ['USERNAME_TAKEN', { username: 'test3', to: 4 }],
      ['USERNAME_RESERVED', { username: 'apple', owner: '0xd469E0504c20185941E73029C6A400bD2dD28A1A', from: 0, to: 123, userFid: 123 }],
      ['INVALID_USERNAME', { username: 'namethatislongerthan16chars', from: 0, to: 10 }],
      ['INVALID_USERNAME', { username: 'invalidchars!', from: 0, to: 10 }],
      ['INVALID_USERNAME', { username: '', from: 0, to: 10 }]
    ])('should throw error %s', async (error, data) => {
      await expect(createTestTransfer(db, data)).rejects.toThrow(error);
    });

    test.each([
      ['INVALID_TIMESTAMP', now - 100],
      ['INVALID_TIMESTAMP', now + (TIMESTAMP_TOLERANCE + 10)],
      ['INVALID_TIMESTAMP', now - (TIMESTAMP_TOLERANCE + 10)],
      ['INVALID_TIMESTAMP', 0]
    ])('must have a valid timestamp (%s)', async (error, timestamp) => {
      await expect(
        createTestTransfer(db, { username: 'test123', from: 1, to: 10, timestamp })
      ).rejects.toThrow(error);
    });
  });

  describe('getLatestTransfer', () => {
    test('should return the latest transfer', async () => {
      const latest = await getLatestTransfer(db, 'test123');
      expect(latest).toBeDefined();
      expect(latest.username).toBe('test123');
    });
  });

  describe('getCurrentUsernames', () => {
    test('should return current usernames', async () => {
      expect(await getCurrentUsername(1, db)).toBeUndefined();
      expect(await getCurrentUsername(2, db)).toBe('test123');
    });
  });
});
