import knex from "knex";
import * as process from "process";


export const getDb = function () {
    const db = knex({
        client: 'sqlite3',
        connection: {
            // memory
            filename: ':memory:',
        }
    });

    db.schema.hasTable('transfers').then((exists: boolean) => {
        if (!exists) {
            return db.schema.createTable('transfers', (table) => {
                table.integer('timestamp').notNullable().index();
                table.string('username').notNullable();
                table.integer('from').notNullable().index();
                table.integer('to').notNullable().index();
                table.text('signature').notNullable();
                table.timestamps(true, true);
            });
        }
    }).then(() => {
        // Seed some data
        db.table('transfers').insert([
            {timestamp: Date.now(), username: 'test1', from: 0, to: 1, signature: 'test'},
            {timestamp: Date.now(), username: 'test2', from: 0, to: 2, signature: 'test'},
            {timestamp: Date.now(), username: 'test3', from: 0, to: 3, signature: 'test'},
            {timestamp: Date.now() + 1, username: 'test3', from: 3, to: 0, signature: 'test'},
        ]).then(() => {
            process.stdout.write(`\nSeeded data`);
        });
    });
    return db;
}