import express, { Express } from "express";
import { getDbClient, migrateToLatest } from './db.js';
import { log } from './log.js';

const PAGE_SIZE = 100;

const db = await getDbClient();
migrateToLatest(db, log);

export const app: Express = express();

app.get('/transfers', async (req, res) => {
  const since = Number(req.query.since ?? 0);
  const transfers = await db
    .selectFrom('transfers')
    .select(['id', 'timestamp', 'username', 'owner', 'from', 'to', 'signature'])
    .where('id', '>', since)
    .limit(PAGE_SIZE)
    .execute();

  res.send({ transfers });
});

app.get('/_health', async (_req, res) => {
  res.send({ status: 'ok' });
});
