import express, { Express, Request, Response } from "express";
import { getDb } from './db.js';

const PAGE_SIZE = 100;

const db = await getDb();
export const app: Express = express();
app.get('/transfers', async (req: Request, res: Response) => {
    const since = req.query.since ?? 0;
    db.from('transfers')
        .select('id', 'timestamp', 'username', 'owner', 'from', 'to', 'signature')
        .where('id', '>', since)
        .limit(PAGE_SIZE)
        .then((rows: any) => {
            res.send({transfers: rows});
        });
});
