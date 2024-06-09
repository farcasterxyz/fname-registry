import { getDbClient, migrateToLatest } from '../src/db.js';
import { log } from '../src/log.js';
import { sql } from 'kysely';
import { getCurrentUsername, getLatestTransfer, TIMESTAMP_TOLERANCE } from '../src/transfers.js';
import { currentTimestamp } from '../src/util.js';
import { createTestTransfer } from './utils.js';
import { generateSignature, signer, signerAddress, signerFid } from '../src/signature.js';
import { ethers } from 'ethers';

const db = getDbClient();
const owner = signerAddress;
const anotherSigner = ethers.Wallet.createRandom();

beforeAll(async () => {
  await migrateToLatest(db, log);
  await sql`TRUNCATE TABLE transfers RESTART IDENTITY`.execute(db);
  await createTestTransfer(db, { username: 'test123', to: 1 });
  await createTestTransfer(db, { username: 'test123', from: 1, to: 2, timestamp: currentTimestamp() + 10 });
  await createTestTransfer(db, { username: 'test3', to: 3, timestamp: currentTimestamp() - 2 });
});

describe('transfers', () => {
  describe('createTransfer', () => {
    test('should throw error if validation fails', async () => {
      await expect(createTestTransfer(db, { username: 'test3', to: 4 })).rejects.toThrow('USERNAME_TAKEN');
    });
  });

  describe('validateTransfer', () => {
    test('cannot register an existing name', async () => {
      await expect(createTestTransfer(db, { username: 'test3', to: 4 })).rejects.toThrow('USERNAME_TAKEN');
    });

    test('cannot register a reserved name with a non-admin account', async () => {
      await expect(
        createTestTransfer(
          db,
          {
            username: 'apple',
            owner: '0xd469E0504c20185941E73029C6A400bD2dD28A1A',
            from: 0,
            to: 123,
            userFid: 123,
          },
          123
        )
      ).rejects.toThrow('USERNAME_RESERVED');
    });

    test('can register a reserved name with an admin account', async () => {
      expect(await createTestTransfer(db, { username: 'apple', to: 123 }));
    });

    test('same fid cannot register twice', async () => {
      await expect(createTestTransfer(db, { username: 'test1234', to: 2 })).rejects.toThrow('TOO_MANY_NAMES');
    });

    test('cannot unregister a nonexistent name', async () => {
      await expect(createTestTransfer(db, { username: 'nonexistent', from: 1, to: 0 })).rejects.toThrow(
        'USERNAME_NOT_FOUND'
      );
    });

    test('cannot transfer a nonexistent name', async () => {
      await expect(createTestTransfer(db, { username: 'nonexistent', from: 1, to: 10 })).rejects.toThrow(
        'USERNAME_NOT_FOUND'
      );
    });

    test('cannot register an invalid name', async () => {
      await expect(
        createTestTransfer(db, { username: 'namethatislongerthan16chars', from: 0, to: 10 })
      ).rejects.toThrow('INVALID_USERNAME');
      await expect(createTestTransfer(db, { username: 'invalidchars!', from: 0, to: 10 })).rejects.toThrow(
        'INVALID_USERNAME'
      );
      await expect(createTestTransfer(db, { username: '', from: 0, to: 10 })).rejects.toThrow('INVALID_USERNAME');
    });

    test('must have a valid timestamp', async () => {
      // Timestamp cannot be older than existing transfer
      await expect(
        createTestTransfer(db, { username: 'test123', from: 1, to: 10, timestamp: currentTimestamp() - 100 })
      ).rejects.toThrow('INVALID_TIMESTAMP');

      // Timestamp cannot be too far in the future
      await expect(
        createTestTransfer(db, {
          username: 'test123',
          from: 2,
          to: 10,
          timestamp: currentTimestamp() + (TIMESTAMP_TOLERANCE + 10),
        })
      ).rejects.toThrow('INVALID_TIMESTAMP');

      // Timestamp cannot be too far in the past
      await expect(
        createTestTransfer(db, {
          username: 'newusername',
          from: 0,
          to: 15,
          timestamp: currentTimestamp() - (TIMESTAMP_TOLERANCE + 10),
        })
      ).rejects.toThrow('INVALID_TIMESTAMP');

      await expect(createTestTransfer(db, { username: 'newusername', from: 0, to: 15, timestamp: 0 })).rejects.toThrow(
        'INVALID_TIMESTAMP'
      );
    });

    test('fails for an invalid signature', async () => {
      const now = currentTimestamp();
      // different name than signed type
      await expect(
        createTestTransfer(db, {
          username: 'differentname',
          to: 5,
          timestamp: now,
          userSignature: await generateSignature('aname', now, owner, signer),
        })
      ).rejects.toThrow('INVALID_SIGNATURE');

      // different timestamp than signed type
      await expect(
        createTestTransfer(db, {
          username: 'aname',
          to: 5,
          timestamp: now + 1,
          userSignature: await generateSignature('aname', now, owner, signer),
        })
      ).rejects.toThrow('INVALID_SIGNATURE');

      // different owner than signed type
      await expect(
        createTestTransfer(db, {
          username: 'aname',
          to: 5,
          timestamp: now,
          owner: anotherSigner.address,
          userSignature: await generateSignature('aname', now, owner, signer),
        })
      ).rejects.toThrow('INVALID_SIGNATURE');
    });

    test('only admins can transfer names owned by other fids', async () => {
      const now = currentTimestamp();

      // FID is not an admin, rejected
      await expect(
        createTestTransfer(db, {
          username: 'name',
          to: 5,
          owner: anotherSigner.address,
          userFid: 1,
        })
      ).rejects.toThrow('UNAUTHORIZED');

      // Fid is an admin, but signature doesn't match known public key, rejected
      await expect(
        createTestTransfer(db, {
          username: 'name',
          to: 5,
          owner: anotherSigner.address,
          userFid: signerFid,
          userSignature: await generateSignature('name', now, owner, signer),
        })
      ).rejects.toThrow('INVALID_SIGNATURE');
    });

    test('user can transfer name if they own the fid', async () => {
      await expect(
        createTestTransfer(
          db,
          {
            username: 'anewname',
            to: 5,
            owner: anotherSigner.address,
            userSignature: await generateSignature(
              'anewname',
              currentTimestamp(),
              anotherSigner.address,
              anotherSigner
            ),
            userFid: 5,
          },
          5
        )
      ).resolves.toBeDefined();
    });

    test('user can only transfer name once in 28 days', async () => {
      await expect(
        createTestTransfer(
          db,
          {
            username: 'anewname',
            to: 5,
            owner: anotherSigner.address,
            userSignature: await generateSignature(
              'anewname',
              currentTimestamp(),
              anotherSigner.address,
              anotherSigner
            ),
            userFid: 5,
          },
          5
        )
      ).resolves.toBeDefined();
      await expect(
        createTestTransfer(
          db,
          {
            username: 'anewname',
            from: 5,
            to: 0,
            owner: anotherSigner.address,
            timestamp: currentTimestamp() + 1,
            userSignature: await generateSignature(
              'anewname',
              currentTimestamp() + 1,
              anotherSigner.address,
              anotherSigner
            ),
            userFid: 5,
          },
          5
        )
      ).rejects.toThrow('THROTTLED');
    });

    test('user cannot transfer name if they do not own the fid', async () => {
      await expect(
        createTestTransfer(
          db,
          {
            username: 'anewname',
            to: 5,
            owner: anotherSigner.address,
            userSignature: await generateSignature(
              'anewname',
              currentTimestamp(),
              anotherSigner.address,
              anotherSigner
            ),
            userFid: 5,
          },
          1
        )
      ).rejects.toThrow('INVALID_FID_OWNER');
    });
    test('fails if userFid does not match transfer fid', async () => {
      await expect(
        createTestTransfer(db, {
          username: 'anewname',
          to: 5,
          owner: anotherSigner.address,
          userFid: 1,
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('getLatestTransfer', () => {
    test('should return the latest transfer', async () => {
      const latest = await getLatestTransfer('test123', db);
      expect(latest).toBeDefined();
      expect(latest!.username).toBe('test123');
      expect(latest!.from).toBe(1);
      expect(latest!.to).toBe(2);
      expect(latest!.user_signature).toBeDefined();
      expect(latest!.server_signature).toBeDefined();
    });
    test('returns undefined if no transfer', async () => {
      const latest = await getLatestTransfer('nonexistent', db);
      expect(latest).toBeUndefined();
    });
  });

  describe('getCurrentUsernames', () => {
    test('should return the current usernames', async () => {
      const username_for_1 = await getCurrentUsername(1, db);
      expect(username_for_1).toBeUndefined();
      const username_for_2 = await getCurrentUsername(2, db);
      expect(username_for_2).toBe('test123');
    });

    test('returns undefined for fid 0', async () => {
      await createTestTransfer(db, { username: 'test123', from: 2, to: 0, timestamp: currentTimestamp() + 20 });
      await createTestTransfer(db, { username: 'test3', from: 3, to: 0 });
      const username_for_0 = await getCurrentUsername(0, db);
      expect(username_for_0).toBeUndefined();
    });
  });
});
