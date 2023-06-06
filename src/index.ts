import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import {getDb} from "./db";

dotenv.config();


const app: Express = express();
const port = process.env.PORT || "2284";
const db = getDb();

app.get('/transfers', (req: Request, res: Response) => {
    db.from('transfers').select('timestamp', 'username', 'from', 'to', 'signature').then((rows: any) => {
        res.send(rows);
    });
});

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});