import request from 'supertest';
import { app } from '../src/app.js';
import { sql } from 'kysely';
import { getDbClient, migrateToLatest } from '../src/db.js';
import { log } from '../src/log.js';
import { generateSignature, signer, signerAddress, signerFid, verifySignature } from '../src/signature.js';
import { currentTimestamp } from '../src/util.js';
import { createTestTransfer } from './utils.js';
import { ethers } from 'ethers';
import { bytesToHex } from '../src/util.js';

const db = getDbClient();
const anotherSigner = ethers.Wallet.createRandom();

beforeAll(async () => {
  await migrateToLatest(db, log);
});

describe('app', () => {
  beforeAll(async () => {
    const now = currentTimestamp();

    await sql`TRUNCATE TABLE transfers RESTART IDENTITY`.execute(db);
    await createTestTransfer(db, { username: 'test1', to: 1, timestamp: now });
    await createTestTransfer(db, { username: 'test2', to: 2, timestamp: now });
    await createTestTransfer(db, { username: 'test3', to: 3, timestamp: now });
    await createTestTransfer(db, { username: 'test3', from: 3, to: 0, timestamp: now + 1 });
  });

  describe('get transfers', () => {
    test('should returns transfers', async () => {
      const response = await request(app).get('/transfers');
      expect(response.status).toBe(200);
      expect(response.body.transfers).toHaveLength(4);
    });

    test('should returns transfers since an id', async () => {
      const response = await request(app).get('/transfers?since=2');
      expect(response.status).toBe(200);
      expect(response.body.transfers).toHaveLength(2);
    });
  });

  describe('create transfer', () => {
    const now = currentTimestamp();

    test('should create a transfer', async () => {
      const user_signature = bytesToHex(await generateSignature('test4', now, anotherSigner.address, signer));
      const response = await request(app).post('/transfers').send({
        name: 'test4',
        from: 0,
        to: 4,
        owner: anotherSigner.address,
        timestamp: now,
        signature: user_signature,
        fid: signerFid,
      });
      expect(response.status).toBe(200);
      const transferRes = response.body.transfer;
      expect(transferRes).toMatchObject({
        username: 'test4',
        from: 0,
        to: 4,
        timestamp: now,
        owner: anotherSigner.address.toLowerCase(),
      });
      expect(verifySignature('test4', now, anotherSigner.address, transferRes.user_signature, signer.address)).toBe(
        true
      );
      expect(verifySignature('test4', now, anotherSigner.address, transferRes.server_signature, signer.address)).toBe(
        true
      );
    });

    test('should throw error if validation fails', async () => {
      const response = await request(app)
        .post('/transfers')
        .send({
          name: 'nonexistent',
          from: 1,
          to: 0,
          owner: anotherSigner.address,
          timestamp: now,
          signature: bytesToHex(await generateSignature('nonexistent', now, anotherSigner.address, signer)),
          fid: signerFid,
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('USERNAME_NOT_FOUND');
    });

    test('should throw error if signature is invalid', async () => {
      const response = await request(app)
        .post('/transfers')
        .send({
          name: 'nonexistent',
          from: 1,
          to: 0,
          owner: anotherSigner.address,
          timestamp: now,
          signature: bytesToHex(await generateSignature('nonexistent', now, signer.address, signer)),
          fid: signerFid,
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('signer', () => {
    test('returns signer address', async () => {
      const response = await request(app).get('/signer');
      expect(response.status).toBe(200);
      expect(response.body.signer.toLowerCase()).toEqual(signerAddress.toLowerCase());
    });
  });
});
