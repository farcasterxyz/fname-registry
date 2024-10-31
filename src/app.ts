import ccipread from '@chainlink/ccip-read-server';
import { ZeroAddress } from 'ethers';

import { getReadClient, getWriteClient, migrateToLatest } from './db.js';
import './env.js';
import { log } from './log.js';
import { generateCCIPSignature, signer, signerAddress } from './signature.js';
import {
  createTransfer,
  getCurrentUsername,
  getLatestTransfer,
  getTransferById,
  getTransferHistory,
  TransferHistoryFilter,
  ValidationError,
} from './transfers.js';

import { currentTimestamp, decodeDnsName } from './util.js';
import { getIdRegistryContract } from './ethereum.js';

export const RESOLVE_ABI = [
  'function resolve(bytes calldata name, bytes calldata data) external view returns(string name, uint256 timestamp, address owner, bytes memory sig)',
];

const write = getWriteClient();
const read = getReadClient();
await migrateToLatest(write, log);
const idContract = getIdRegistryContract();

const server = new ccipread.Server();

server.add(RESOLVE_ABI, [
  {
    type: 'resolve',
    func: async ([name, _data], _req) => {
      const fname = decodeDnsName(name)[0];
      const transfer = await getLatestTransfer(fname, read);
      if (!transfer || transfer.to === 0) {
        // If no transfer or the name was unregistered, return empty values
        return ['', 0, ZeroAddress, '0x'];
      }
      const signature = await generateCCIPSignature(transfer.username, transfer.timestamp, transfer.owner, signer);
      return [transfer.username, transfer.timestamp, transfer.owner, signature];
    },
  },
]);

export const app = server.makeApp('/ccip/');

app.get('/transfers', async (req, res) => {
  const filterOpts: TransferHistoryFilter = {};
  if (req.query.from_id) {
    filterOpts.fromId = parseInt(req.query.from_id.toString());
  }
  // TODO: Remove once hub is fixed
  if (req.query.fromId) {
    filterOpts.fromId = parseInt(req.query.fromId.toString());
  }
  if (req.query.name) {
    filterOpts.name = req.query.name.toString().replace(/\0/g, '');
  }
  if (req.query.from_ts) {
    filterOpts.fromTs = parseInt(req.query.from_ts.toString());
  }
  if (req.query.fid) {
    filterOpts.fid = parseInt(req.query.fid.toString());
  }
  try {
    const transfers = await getTransferHistory(filterOpts, read);
    res.send({ transfers });
  } catch (e) {
    res.status(400).send({ error: 'Unable to get transfers' }).end();
    log.error(e, `Unable to get transfers for request: ${JSON.stringify(req.query)}`);
    return;
  }
});

app.get('/transfers/current', async (req, res) => {
  try {
    let name: string | undefined;
    if (req.query.fid) {
      if (Number.isNaN(Number(req.query.fid))) {
        res.status(400).send({ error: 'FID is not a number' }).end();
        return;
      }
      name = await getCurrentUsername(parseInt(req.query.fid.toString()), read);
    } else if (req.query.name) {
      name = req.query.name.toString();
    }
    if (!name || name === '') {
      res.status(404).send({ error: 'Could not resolve current name' }).end();
      return;
    }
    const transfer = await getLatestTransfer(name, read);
    if (!transfer || transfer.to === 0) {
      res.status(404).send({ error: 'No transfer found' }).end();
      return;
    }
    res.send({ transfer });
  } catch (e) {
    res.status(400).send({ error: 'Unable to get transfer' }).end();
    log.error(e, `Unable to get transfers for query: ${JSON.stringify(req.query)}`);
    return;
  }
});

app.post('/transfers', async (req, res) => {
  let tr;
  try {
    tr = req.body;
    const result = await createTransfer(
      {
        username: tr.name,
        from: tr.from,
        to: tr.to,
        timestamp: tr.timestamp,
        owner: tr.owner,
        userSignature: tr.signature,
        userFid: tr.fid,
      },
      write,
      idContract
    );
    if (!result) {
      log.warn({ name: tr.username }, `Unable to create transfer`);
      res.status(500).send({ error: 'Unable to create transfer' }).end();
      return;
    }
    const transfer = await getTransferById(result.id, write);
    res.send({ transfer });
  } catch (e: unknown) {
    if (e instanceof ValidationError) {
      res.status(400).send({ error: 'Validation failure', code: e.code }).end();
    } else {
      log.error(e, `Unable to create transfer: ${JSON.stringify(tr)}`);
      res
        .status(500)
        .send({ error: `Unable to validate : ${e}` })
        .end();
    }
  }
});

app.get('/signer', async (_req, res) => {
  res.send({ signer: signerAddress });
});

app.get('/_health', async (_req, res) => {
  res.send({ status: 'ok' });
});

app.get('/current-time', async (_req, res) => {
  res.send({ currentTime: currentTimestamp() });
});
