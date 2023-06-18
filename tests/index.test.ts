import request from 'supertest';
import { app } from '../src/app.js';
import { sql } from 'kysely';
import { signer, generateSignature } from '../src/signature.js';
import { getDbClient, migrateToLatest } from '../src/db.js'
import { log } from '../src/log.js';

const db = await getDbClient();
const owner = Uint8Array.from(Buffer.from('f39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'hex'));

beforeAll(async () => {
  await migrateToLatest(db, log);
});

describe('app', () => {
  beforeAll(async () => {
    const now = Math.floor(Date.now()/1000);

    await sql`truncate transfers`.execute(db);
    await db.insertInto('transfers').values([
      {
        timestamp: now,
        username: 'test1',
        owner,
        from: 0,
        to: 1,
        signature: await generateSignature('test1', now, owner, signer)
      },
      {
        timestamp: now,
        username: 'test2',
        owner,
        from: 0,
        to: 2,
        signature: await generateSignature('test2', now, owner, signer)
      },
      {
        timestamp: now,
        username: 'test3',
        owner,
        from: 0,
        to: 3,
        signature: await generateSignature('test3', now, owner, signer)
      },
      {
        timestamp: now + 1,
        username: 'test3',
        owner,
        from: 3,
        to: 0,
        signature: await generateSignature('test3', now + 1, owner, signer)
      },
    ]).execute();
  });

  test('should returns transfers', async () => {
    const response = await request(app).get('/transfers');
    expect(response.status).toBe(200);
    expect(response.body.transfers).toHaveLength(4);
  });

  // TODO: Fix this test
  //test('should returns transfers since an id', async () => {
    //const response = await request(app).get('/transfers?since=2');
    //expect(response.status).toBe(200);
    //expect(response.body.transfers).toHaveLength(2);
  //});
})
