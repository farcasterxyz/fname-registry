import { Kysely, CamelCasePlugin, Generated, GeneratedAlways, Migrator, FileMigrationProvider } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import * as path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { Logger } from './log.js';
import { err, ok, Result } from 'neverthrow';

const POSTGRES_URL =
  process.env['ENVIRONMENT'] === 'test'
    ? 'postgres://app:password@localhost:6543/registry_test'
    : process.env['POSTGRES_URL'] || 'postgres://app:password@localhost:6543/registry_dev';

export interface Database {
  transfers: TransfersTable;
}

export interface TransfersTable {
  id: GeneratedAlways<number>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  timestamp: number;
  username: string;
  owner: Uint8Array;
  from: number;
  to: number;
  userSignature: Uint8Array;
  serverSignature: Uint8Array;
  userFid: number;
}

export const getDbClient = () => {
  return new Kysely<Database>({
    dialect: new PostgresJSDialect({
      postgres: postgres(POSTGRES_URL, {
        max: 10,
        types: {
          // BigInts will not exceed Number.MAX_SAFE_INTEGER for our use case.
          // Return as JavaScript's `number` type so it's easier to work with.
          bigint: {
            to: 20,
            from: [20],
            parse: (x: any) => Number(x),
            serialize: (x: any) => x.toString(),
          },
        },
      }),
    }),
    plugins: [new CamelCasePlugin()],
  });
};

export const migrateToLatest = async (db: Kysely<any>, log: Logger): Promise<Result<void, unknown>> => {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      log.info(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      log.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    log.error('failed to migrate');
    log.error(error);
    return err(error);
  }

  return ok(undefined);
};
