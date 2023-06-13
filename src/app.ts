import express, {Express, Request, Response} from "express";
import {getDb} from "./db";

const PAGE_SIZE = 100;

export const app: Express = express();
app.get('/transfers', async (req: Request, res: Response) => {
    const db = await getDb();
    const since = req.query.since ?? 0;
    db.from('transfers')
        .select('id', 'timestamp', 'username', 'owner', 'from', 'to', 'signature')
        .where('id', '>', since)
        .limit(PAGE_SIZE)
        .then((rows: any) => {
            res.send({transfers: rows});
        });
});
