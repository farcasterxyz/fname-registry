import request from 'supertest';
import { app, RESOLVE_ABI } from '../src/app.js';
import { sql } from 'kysely';
import { getWriteClient, migrateToLatest } from '../src/db.js';
import { log } from '../src/log.js';
import {
  generateSignature,
  signer,
  signerAddress,
  signerFid,
  verifyCCIPSignature,
  verifySignature,
} from '../src/signature.js';
import { bytesToHex, currentTimestamp } from '../src/util.js';
import { createTestTransfer } from './utils.js';
import { AbiCoder, ethers, Interface, ZeroAddress } from 'ethers';
import { CCIP_ADDRESS } from '../src/env.js';

const db = getWriteClient();
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

    test('does not fail for zero padded names', async () => {
      const zeroPaddedName = Buffer.concat([Buffer.from('test2'), Buffer.alloc(3)]).toString('utf-8');
      const response = await request(app).get(`/transfers?name=${zeroPaddedName}`);
      expect(response.status).toBe(200);
      expect(response.body.transfers).toHaveLength(1);
      expect(response.body.transfers[0]).toMatchObject({ username: 'test2' });
    });
  });

  describe('get current transfer', () => {
    test('returns error for unknown name', async () => {
      let response = await request(app).get('/transfers/current?name=nonexistent');
      expect(response.status).toBe(404);

      // Name was burned
      response = await request(app).get('/transfers/current?name=test3');
      expect(response.status).toBe(404);
    });
    test('returns error for unknown fid', async () => {
      let response = await request(app).get('/transfers/current?fid=129837123');
      expect(response.status).toBe(404);

      // Name was burned
      response = await request(app).get('/transfers/current?fid=3');
      expect(response.status).toBe(404);
    });
    test('returns error if no name or fid provided', async () => {
      const response = await request(app).get('/transfers/current');
      expect(response.status).toBe(404);
    });
    test('returns latest transfer for fid', async () => {
      await createTestTransfer(db, { username: 'test-current', from: 0, to: 3, timestamp: now + 3 });
      const response = await request(app).get('/transfers/current?fid=3');
      expect(response.status).toBe(200);
      expect(response.body.transfer).toMatchObject({ username: 'test-current', from: 0, to: 3, timestamp: now + 3 });
    });
    test('returns latest transfer for name', async () => {
      await createTestTransfer(db, { username: 'test3', from: 0, to: 10, timestamp: now + 3 });
      const response = await request(app).get('/transfers/current?name=test3');
      expect(response.status).toBe(200);
      expect(response.body.transfer).toMatchObject({ username: 'test3', from: 0, to: 10, timestamp: now + 3 });
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

  describe('ccip resolution', () => {
    const resolveABI = new Interface(RESOLVE_ABI).getFunction('resolve')!;

    it('should return a valid signature for a ccip lookup of a registered name', async () => {
      // Calldata for test1.farcaster.xyz
      const callData =
        '0x9061b923000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000015057465737431096661726361737465720378797a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000243b3b57deeea35aa5de7e8da11d1636463a57da877fa0c0c65b969f7fecb7eb6c93a20c1b00000000000000000000000000000000000000000000000000000000';
      const response = await request(app).get(`/ccip/${CCIP_ADDRESS}/${callData}.json`);
      expect(response.status).toBe(200);
      const [username, timestamp, owner, signature] = AbiCoder.defaultAbiCoder().decode(
        resolveABI.outputs,
        response.body.data
      );
      expect(username).toBe('test1');
      expect(verifyCCIPSignature(username, timestamp, owner, signature, signer.address)).toBe(true);
      // CCIP domain is different from hub domain
      expect(verifySignature(username, timestamp, owner, signature, signer.address)).toBe(false);
    });

    it('should return an empty signature for a ccip lookup of an unregistered name', async () => {
      // Calldata for alice.farcaster.xyz
      const callData =
        '0x9061b92300000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000001505616c696365096661726361737465720378797a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000243b3b57de00d4f449060ad2a07ff5ad355ae8da52281e95f6ad10fb923ae7cad9f2c43c2a00000000000000000000000000000000000000000000000000000000';
      const response = await request(app).get(`/ccip/${CCIP_ADDRESS}/${callData}.json`);
      expect(response.status).toBe(200);
      const [username, timestamp, owner, signature] = AbiCoder.defaultAbiCoder().decode(
        resolveABI.outputs,
        response.body.data
      );
      expect(username).toBe('');
      expect(timestamp.toString()).toEqual('0');
      expect(owner).toBe(ZeroAddress);
      expect(signature).toBe('0x');
    });
  });
});
