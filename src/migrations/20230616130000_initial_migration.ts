import { Kysely, sql } from 'kysely';

export const up = async (db: Kysely<any>) => {
  await db.schema
    .createTable('transfers')
    .addColumn('id', 'bigint', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .addColumn('updatedAt', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .addColumn('timestamp', 'integer', (col) => col.notNull())
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('owner', 'bytea', (col) => col.notNull())
    .addColumn('from', 'integer', (col) => col.notNull())
    .addColumn('to', 'integer', (col) => col.notNull())
    .addColumn('user_signature', 'bytea', (col) => col.notNull())
    .addColumn('server_signature', 'bytea', (col) => col.notNull())
    .addColumn('user_fid', 'integer')
    .execute();

  await db.schema.createIndex('transfers_from_index').on('transfers').columns(['from']).execute();

  await db.schema.createIndex('transfers_to_index').on('transfers').columns(['to']).execute();

  // Cannot have two proofs for the same username at the same time
  await db.schema
    .createIndex('transfers_username_timestamp_unique')
    .on('transfers')
    .columns(['username', 'timestamp'])
    .execute();
};

export const down = async (db: Kysely<any>) => {
  await db.schema.dropTable('transfers').ifExists().execute();
};
