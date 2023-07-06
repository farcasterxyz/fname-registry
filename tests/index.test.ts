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
  const now = currentTimestamp();

  beforeAll(async () => {
    await sql`TRUNCATE TABLE transfers RESTART IDENTITY`.execute(db);
    await createTestTransfer(db, { username: 'test1', to: 1, timestamp: now });
    await createTestTransfer(db, { username: 'test2', to: 2, timestamp: now });
    await createTestTransfer(db, { username: 'test3', to: 3, timestamp: now + 1 });
    await createTestTransfer(db, { username: 'test3', from: 3, to: 0, timestamp: now + 2 });
  });

  describe('get transfers', () => {
    test('should returns transfers', async () => {
      const response = await request(app).get('/transfers');
      expect(response.status).toBe(200);
      expect(response.body.transfers).toHaveLength(4);
    });

    test('should returns transfers from an id', async () => {
      const response = await request(app).get('/transfers?from_id=2');
      expect(response.status).toBe(200);
      expect(response.body.transfers).toHaveLength(2);
    });

    test('should returns transfers from a timestamp', async () => {
      const response = await request(app).get(`/transfers?from_ts=${now}`);
      expect(response.status).toBe(200);
      expect(response.body.transfers).toHaveLength(2);
      expect(response.body.transfers[0]).toMatchObject({ timestamp: now + 1 });
      expect(response.body.transfers[1]).toMatchObject({ timestamp: now + 2 });
    });

    test('should returns transfers for a name', async () => {
      const response = await request(app).get('/transfers?name=test2');
      expect(response.status).toBe(200);
      expect(response.body.transfers).toHaveLength(1);
      expect(response.body.transfers[0]).toMatchObject({ username: 'test2' });
    });

    test('should returns transfers for an fid', async () => {
      const response = await request(app).get('/transfers?fid=3');
      expect(response.status).toBe(200);
      // Includes both from and to
      expect(response.body.transfers).toHaveLength(2);
      expect(response.body.transfers[0]).toMatchObject({ username: 'test3', from: 0, to: 3 });
      expect(response.body.transfers[1]).toMatchObject({ username: 'test3', from: 3, to: 0 });
    });

    test('combines multiple queries', async () => {
      const response = await request(app).get(`/transfers?name=test3&from_ts=${now + 1}`);
      expect(response.status).toBe(200);
      // Includes both from and to
      expect(response.body.transfers).toHaveLength(1);
      expect(response.body.transfers[0]).toMatchObject({ username: 'test3', from: 3, to: 0, timestamp: now + 2 });
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

    test('registering the same name to the same owner and fid twice should not fail', async () => {
      const user_signature = bytesToHex(await generateSignature('testreuse', now, signerAddress, signer));
      const transfer_request = {
        name: 'testreuse',
        from: 0,
        to: 5,
        owner: signerAddress,
        timestamp: now,
        signature: user_signature,
        fid: signerFid,
      };
      const response = await request(app).post('/transfers').send(transfer_request);
      expect(response.status).toBe(200);

      // Posting the same request again should not fail
      const second_response = await request(app).post('/transfers').send(transfer_request);
      expect(second_response.status).toBe(200);

      // Posting the same request with a different owner address should fail
      const bad_owner_response = await request(app)
        .post('/transfers')
        .send({
          ...transfer_request,
          owner: anotherSigner.address,
          signature: bytesToHex(await generateSignature('testreuse', now, anotherSigner.address, signer)),
        });
      expect(bad_owner_response.status).toBe(400);
      expect(bad_owner_response.body.code).toBe('TOO_MANY_NAMES');
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
