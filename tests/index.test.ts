import request from 'supertest';
import { app } from '../src/app.js';
import { sql } from 'kysely';
import { getDbClient, migrateToLatest } from '../src/db.js'
import { log } from '../src/log.js';
import {createTransfer} from "../src/transfers";
import {signerAddress} from "../src/signature";

const db = await getDbClient();
const owner = Uint8Array.from(Buffer.from(signerAddress.slice(2), 'hex'));

beforeAll(async () => {
  await migrateToLatest(db, log);
});

describe('app', () => {
  beforeAll(async () => {
    const now = Math.floor(Date.now()/1000);

    await sql`TRUNCATE TABLE transfers RESTART IDENTITY`.execute(db);
    await createTransfer({
      timestamp: now,
      username: 'test1',
      owner,
      from: 0,
      to: 1,
    }, db);
    await createTransfer({
      timestamp: now,
      username: 'test2',
      owner,
      from: 0,
      to: 2,
    }, db);
    await createTransfer({
      timestamp: now,
      username: 'test3',
      owner,
      from: 0,
      to: 3,
    }, db);
    await createTransfer({
      timestamp: now + 1,
      username: 'test3',
      owner,
      from: 3,
      to: 0,
    }, db);
  });

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

  describe('signer', () => {
    test('returns signer address', async () => {
      const response = await request(app).get('/signer');
      expect(response.status).toBe(200);
      expect(response.body.signer.toLowerCase()).toEqual('0x' + Buffer.from(owner).toString('hex').toLowerCase());
    });
  });
})
