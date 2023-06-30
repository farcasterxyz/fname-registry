import ccipread from '@chainlink/ccip-read-server';
import { getDbClient, migrateToLatest } from './db.js';
import './env.js';
import { log } from './log.js';
import { generateCCIPSignature, signer, signerAddress } from './signature.js';
import {
  createTransfer,
  getLatestTransfer,
  getTransferById,
  getTransferHistory,
  TransferHistoryFilter,
  ValidationError,
} from './transfers.js';

const abi = [
  'function resolve(bytes calldata name) external view returns(string name, uint64 timestamp, address owner, bytes memory sig)',
];

const db = getDbClient();
await migrateToLatest(db, log);

const server = new ccipread.Server();

server.add(abi, [
  {
    type: 'resolve',
    func: async ([name], _req) => {
      const transfer = await getLatestTransfer(name, db);
      if (!transfer || transfer.to === 0) {
        // If no transfer or the name was unregistered, return empty values
        return ['', 0, '', '0x'];
      }
      const signature = await generateCCIPSignature(transfer.username, transfer.timestamp, transfer.owner, signer);
      return [transfer.username, transfer.timestamp, transfer.owner, signature];
    },
  },
]);

export const app = server.makeApp('/ccip');

app.get('/transfers', async (req, res) => {
  const filterOpts: TransferHistoryFilter = {};
  if (req.query.from_id) {
    filterOpts.fromId = parseInt(req.query.from_id.toString());
  }
  if (req.query.name) {
    filterOpts.name = req.query.name.toString();
  }
  if (req.query.from_ts) {
    filterOpts.fromTs = parseInt(req.query.from_ts.toString());
  }
  if (req.query.fid) {
    filterOpts.fid = parseInt(req.query.fid.toString());
  }
  const transfers = await getTransferHistory(filterOpts, db);
  res.send({ transfers });
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
      db
    );
    if (!result) {
      log.warn({ name: tr.username }, `Unable to create transfer`);
      res.status(500).send({ error: 'Unable to create transfer' }).end();
      return;
    }
    const transfer = await getTransferById(result.id, db);
    res.send({ transfer });
  } catch (e: unknown) {
    if (e instanceof ValidationError) {
      res.status(400).send({ error: 'Validation failure', code: e.code }).end();
    } else {
      log.error(e, 'Unable to create transfer', tr);
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
