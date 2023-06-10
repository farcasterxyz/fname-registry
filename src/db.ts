import knex from "knex";
import * as process from "process";
import {ethers} from "ethers";
import {generateSignature} from "./signature";
import * as console from "console";


export async function getDb () {
    const db = knex({
        client: 'sqlite3',
        connection: {
            // memory
            filename: ':memory:',
        }
    });

    const exists = await db.schema.hasTable('transfers')
    if (!exists) {
        await db.schema.createTable('transfers', (table) => {
            table.integer('timestamp').notNullable().index();
            table.string('username').notNullable();
            table.string('owner').notNullable();
            table.integer('from').notNullable().index();
            table.integer('to').notNullable().index();
            table.text('signature').notNullable();
            table.timestamps(true, true);
            table.unique(['timestamp', 'username']); // Cannot have two proofs for the same username at the same time
        });

        const signer = ethers.Wallet.fromPhrase('test test test test test test test test test test test junk');
        console.log(`Using signer address ${signer.address}`);
        const testData = [
            {timestamp: Date.now(), username: 'test1', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', from: 0, to: 1},
            {timestamp: Date.now(), username: 'test2', owner:'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', from: 0, to: 2},
            {timestamp: Date.now(), username: 'test3', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' , from: 0, to: 3},
            {timestamp: Date.now() + 1, username: 'test3', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', from: 3, to: 0},
        ]

        for (const row of testData) {
            await db.table('transfers').insert(
                {...row, signature: await generateSignature(row.username, row.timestamp, row.owner, signer)}
            );
        }
        console.log(`Seeded data`);
    }
    return db;
}