# fname Registry

A centralized registry for Farcaster usernames (fnames). Exposes an HTTP API for getting information about recent registrations, etc.

## Getting started

1. Start Postgres: `docker compose up --detach`
2. Create test DB: `echo 'create database registry_test' | PGPASSWORD=password psql -h localhost -p 6543 -U app registry_dev`
3. Install packages: `yarn install`
4. Run tests: `yarn test`
5. Run the server locally: `yarn start`

## Updating Node.js version

1. Update `.node-version` and `.tool-versions` files
2. Update `Dockerfile` Node.js base image version to match
