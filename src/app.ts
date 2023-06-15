import express, { Express } from "express";
import { getDb } from './db.js';

const PAGE_SIZE = 100;

const db = await getDb();
export const app: Express = express();

app.get('/transfers', async (req, res) => {
  const since = req.query.since ?? 0;
  db.from('transfers')
    .select('id', 'timestamp', 'username', 'owner', 'from', 'to', 'signature')
    .where('id', '>', since)
    .limit(PAGE_SIZE)
    .then((rows: any) => {
      res.send({transfers: rows});
    });
});

app.get('/_health', async (_req, res) => {
  res.send({ status: 'ok' });
});
