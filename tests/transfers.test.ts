import { getWriteClient, migrateToLatest } from '../src/db.js';
import { log } from '../src/log.js';
import { sql } from 'kysely';
import { getCurrentUsername, getLatestTransfer, TIMESTAMP_TOLERANCE } from '../src/transfers.js';
import { currentTimestamp, hexToBytes } from '../src/util.js';
import { createTestTransfer } from './utils.js';
import { generateSignature, signer, signerAddress, signerFid } from '../src/signature.js';
import { ethers } from 'ethers';

const db = getWriteClient();
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

    test('cannot transfer twice', async () => {
      await createTestTransfer(db, { username: 'test10', from: 0, to: 10, timestamp: currentTimestamp() + 1 });
      await createTestTransfer(db, { username: 'test10', from: 10, to: 11, timestamp: currentTimestamp() + 2 });

      // 10 Cannot transfer again
      await expect(
        createTestTransfer(db, { username: 'test10', from: 10, to: 0, timestamp: currentTimestamp() + 3 })
      ).rejects.toThrow('USERNAME_TAKEN');
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
      const latest = await getLatestTransfer(db, 'test123');
      expect(latest).toBeDefined();
      expect(latest!.username).toBe('test123');
      expect(latest!.from).toBe(1);
      expect(latest!.to).toBe(2);
      expect(latest!.user_signature).toBeDefined();
      expect(latest!.server_signature).toBeDefined();
    });
    test('returns latest transfer overall if no name is provided', async () => {
      const latest = await getLatestTransfer(db);
      expect(latest).toBeDefined();
      expect(latest!.username).toBe('test123');
      expect(latest!.from).toBe(1);
      expect(latest!.to).toBe(2);
      expect(latest!.user_signature).toBeDefined();
      expect(latest!.server_signature).toBeDefined();
    });
    test('returns undefined if no transfer', async () => {
      const latest = await getLatestTransfer(db, 'nonexistent');
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

  describe('signature replay', () => {
    test('rejects a transfer from fid 0 to fid 0', async () => {
      // An address that owns no fid resolves to fid 0 on-chain, so it would pass the fid ownership check
      const stranger = ethers.Wallet.createRandom();
      const now = currentTimestamp();
      await expect(
        createTestTransfer(
          db,
          {
            username: 'zerotozero',
            from: 0,
            to: 0,
            owner: stranger.address,
            timestamp: now,
            userSignature: await generateSignature('zerotozero', now, stranger.address, stranger),
            userFid: 0,
          },
          0
        )
      ).rejects.toThrow('UNAUTHORIZED');

      // Admins cannot do it either
      await expect(createTestTransfer(db, { username: 'zerotozero', from: 0, to: 0 })).rejects.toThrow('UNAUTHORIZED');

      // The request body is not validated, so the fids can arrive as strings
      const zero = '0' as unknown as number;
      await expect(createTestTransfer(db, { username: 'zerotozero', from: zero, to: zero })).rejects.toThrow(
        'UNAUTHORIZED'
      );
      expect(await getLatestTransfer(db, 'zerotozero')).toBeUndefined();
    });

    test('a server signature cannot be replayed as an admin signature', async () => {
      const user = ethers.Wallet.createRandom();
      const now = currentTimestamp();
      await createTestTransfer(
        db,
        {
          username: 'replayserver',
          to: 600,
          owner: user.address,
          timestamp: now,
          userSignature: await generateSignature('replayserver', now, user.address, user),
          userFid: 600,
        },
        600
      );
      const minted = await getLatestTransfer(db, 'replayserver');
      expect(minted!.server_signature).not.toBe(minted!.user_signature);

      // The server key is an admin key and it signs the same message, so its public signature verifies as an admin's
      await expect(
        createTestTransfer(db, {
          username: 'replayserver',
          from: 600,
          to: 601,
          owner: user.address,
          timestamp: now,
          userSignature: hexToBytes(minted!.server_signature),
          userFid: signerFid,
        })
      ).rejects.toThrow('INVALID_TIMESTAMP');
      expect((await getLatestTransfer(db, 'replayserver'))!.to).toBe(600);
    });

    test('an admin signature cannot be replayed with a different from and to', async () => {
      const now = currentTimestamp();
      await createTestTransfer(db, { username: 'replayadmin', to: 700, timestamp: now });

      // createTestTransfer signs (name, timestamp, owner) again, which gives the same signature as the mint
      await expect(
        createTestTransfer(db, { username: 'replayadmin', from: 700, to: 701, timestamp: now })
      ).rejects.toThrow('INVALID_TIMESTAMP');
      await expect(
        createTestTransfer(db, { username: 'replayadmin', from: 700, to: 0, timestamp: now })
      ).rejects.toThrow('INVALID_TIMESTAMP');
      expect((await getLatestTransfer(db, 'replayadmin'))!.to).toBe(700);

      // A new signature with a later timestamp still works
      await createTestTransfer(db, { username: 'replayadmin', from: 700, to: 701, timestamp: now + 1 });
      expect((await getLatestTransfer(db, 'replayadmin'))!.to).toBe(701);
    });

    test('a reused timestamp is rejected when it arrives as a string', async () => {
      const now = currentTimestamp();
      await createTestTransfer(db, { username: 'replaystring', to: 710, timestamp: now });

      await expect(
        createTestTransfer(db, {
          username: 'replaystring',
          from: 710,
          to: 711,
          timestamp: String(now) as unknown as number,
        })
      ).rejects.toThrow('INVALID_TIMESTAMP');
      expect((await getLatestTransfer(db, 'replaystring'))!.to).toBe(710);
    });

    test('retrying a request that already succeeded behaves as before', async () => {
      const now = currentTimestamp();

      // Mint and transfer retries return the existing transfer
      const mint = await createTestTransfer(db, { username: 'retryname', to: 720, timestamp: now });
      expect(await createTestTransfer(db, { username: 'retryname', to: 720, timestamp: now })).toEqual(mint);
      const transfer = await createTestTransfer(db, { username: 'retryname', from: 720, to: 721, timestamp: now + 1 });
      expect(await createTestTransfer(db, { username: 'retryname', from: 720, to: 721, timestamp: now + 1 })).toEqual(
        transfer
      );

      // A burn retry keeps its error code
      await createTestTransfer(db, { username: 'retryname', from: 721, to: 0, timestamp: now + 2 });
      await expect(
        createTestTransfer(db, { username: 'retryname', from: 721, to: 0, timestamp: now + 2 })
      ).rejects.toThrow('USERNAME_NOT_FOUND');

      // The name can be registered again with a later timestamp
      await createTestTransfer(db, { username: 'retryname', to: 722, timestamp: now + 3 });
      expect((await getLatestTransfer(db, 'retryname'))!.to).toBe(722);
    });
  });

  describe('concurrent requests', () => {
    const countTransfers = async (username: string) => {
      const rows = await db.selectFrom('transfers').select('id').where('username', '=', username).execute();
      return rows.length;
    };

    // Signature checks call an RPC, so requests reach the database at different times and a race shows up only by
    // chance. This holds a table lock until every request waits on a lock, then lets them all continue together.
    const runTogether = async <T>(requests: (() => Promise<T>)[]) => {
      const blocker = getWriteClient();
      let release = () => {};
      const released = new Promise<void>((resolve) => (release = resolve));
      let tableLocked = () => {};
      const locked = new Promise<void>((resolve) => (tableLocked = resolve));
      const holder = blocker.transaction().execute(async (trx) => {
        await sql`LOCK TABLE transfers IN ACCESS EXCLUSIVE MODE`.execute(trx);
        tableLocked();
        await released;
      });
      await locked;

      const settled = Promise.allSettled(requests.map((run) => run()));
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const waiting = await sql<{
          count: number;
        }>`SELECT count(*)::int AS count FROM pg_locks WHERE NOT granted`.execute(blocker);
        if (waiting.rows[0]!.count >= requests.length) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      release();
      await holder;
      await blocker.destroy();
      return settled;
    };

    test('one name cannot be registered to two fids at the same time', async () => {
      const now = currentTimestamp();
      const fids = [800, 801, 802, 803, 804, 805];
      const results = await runTogether(
        fids.map((to, i) => () => createTestTransfer(db, { username: 'racename', to, timestamp: now + i }))
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') {
          expect(String(result.reason)).toMatch(/USERNAME_TAKEN|INVALID_TIMESTAMP/);
        }
      }
      expect(await countTransfers('racename')).toBe(1);
    });

    test('one fid cannot register two names at the same time', async () => {
      const now = currentTimestamp();
      const names = ['racefid-a', 'racefid-b', 'racefid-c', 'racefid-d', 'racefid-e', 'racefid-f'];
      const results = await runTogether(
        names.map((username) => () => createTestTransfer(db, { username, to: 810, timestamp: now }))
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') {
          expect(String(result.reason)).toMatch(/TOO_MANY_NAMES/);
        }
      }
      const counts = await Promise.all(names.map(countTransfers));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    });

    test('overlapping retries of one request record one transfer', async () => {
      const now = currentTimestamp();
      const results = await runTogether(
        Array.from(
          { length: 6 },
          () => () => createTestTransfer(db, { username: 'raceretry', to: 820, timestamp: now })
        )
      );

      const ids = results.map((r) => (r.status === 'fulfilled' ? r.value!.id : r.reason));
      expect(new Set(ids).size).toBe(1);
      expect(typeof ids[0]).toBe('number');
      expect(await countTransfers('raceretry')).toBe(1);
    });
  });
});
