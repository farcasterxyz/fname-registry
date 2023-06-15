# fname Registry

A centralized registry for Farcaster usernames (fnames). Exposes an HTTP API for getting information about recent registrations, etc.

## Getting started

1. Install packages: `yarn install`
2. Run tests: `yarn test`
3. Run the server locally: `yarn start`

## Deploying

Once a change is merged it is deployed automatically. Check the GitHub Actions workflow result to confirm whether the deploy was successful.

## Updating Node.js version

1. Update `.node-version` and `.tool-versions` files
2. Update `Dockerfile` Node.js base image version to match
