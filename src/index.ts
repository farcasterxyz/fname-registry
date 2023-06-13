import dotenv from 'dotenv';
dotenv.config();

import {app} from "./app";

const port = process.env.PORT || "2284";
app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});