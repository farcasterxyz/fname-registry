import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import {getDb} from "./db";


(async () => {
    const app: Express = express();
    const port = process.env.PORT || "2284";
    const db = await getDb();

    app.get('/transfers', (req: Request, res: Response) => {
        db.from('transfers').select('timestamp', 'username', 'owner', 'from', 'to', 'signature').then((rows: any) => {
            res.send({transfers: rows});
        });
    });

    app.listen(port, () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });
})();