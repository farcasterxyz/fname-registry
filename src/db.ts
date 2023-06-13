import knex from "knex";
import {ethers} from "ethers";
import {generateSignature} from "./signature";

const MNEMONIC = process.env.MNEMONIC || "test test test test test test test test test test test junk";

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
            table.bigIncrements('id', { primaryKey: true });
            table.integer('timestamp').notNullable();
            table.string('username').notNullable().index();
            table.string('owner').notNullable();
            table.integer('from').notNullable().index();
            table.integer('to').notNullable().index();
            table.text('signature').notNullable();
            table.timestamps(true, true);
            table.unique(['timestamp', 'username']); // Cannot have two proofs for the same username at the same time
        });

        const signer = ethers.Wallet.fromPhrase(MNEMONIC);
        console.log(`Using signer address ${signer.address}`);
        const testData = [
            {timestamp: Math.floor(Date.now()/1000), username: 'test1', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', from: 0, to: 1},
            {timestamp: Math.floor(Date.now()/1000), username: 'test2', owner:'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', from: 0, to: 2},
            {timestamp: Math.floor(Date.now()/1000), username: 'test3', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' , from: 0, to: 3},
            {timestamp: (Math.floor(Date.now()/1000) + 1), username: 'test3', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', from: 3, to: 0},
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