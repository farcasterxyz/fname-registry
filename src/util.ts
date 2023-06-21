import {
  LogDescription,
  ParamType,
  Result,
  getBytes,
  toBeHex,
  toQuantity,
  concat,
  toUtf8Bytes,
  BigNumberish,
  ZeroHash,
} from 'ethers';

export type EventArgBasicValue = string | number | boolean;
type EventArgValue = EventArgBasicValue | EventArgBasicValue[] | EventArgs;
export type EventArgs = {
  [key: string]: EventArgValue;
};

export const toBytes16Hex = (text: string) => {
  return toBeHex(concat([toUtf8Bytes(text), ZeroHash]).slice(0, 16));
};

export const fromBytes32Hex = (bn: BigNumberish) => {
  return Buffer.from(getBytes(toQuantity(bn)))
    .toString('utf8')
    .replace(/\0/g, '');
};

// Alchemy's docs sometimes say the value is a string (e.g. in https://docs.alchemy.com/reference/alchemy-gettransactionreceipts),
// but the type of the resulting TS object is number. This method converts the hex string to a number.
// It will throw an error if the value overflows a JS number
// export const fixAlchemyNumber = (value: any): number => {
//   return BigNumberish.from(value).toNumber();
// };

export const contractArgsToObject = (args: Result): Readonly<Record<string, any>> => {
  const cleanObject: Record<string, any> = {};
  for (const propertyName in args) {
    // Exclude keys that are just array indices. We are only interested in the
    // non-numeric keys since they are well-named. We cast to `any` since
    // isNaN still works with non-numeric values, but is typed to only accept
    // numbers for some reason.
    if (isNaN(propertyName as any)) {
      const arg = args[propertyName];
      cleanObject[propertyName] = arg.__proto__.toHexString ? arg.toHexString() : arg;
    }
  }
  return cleanObject;
};

export const contractArgsToObject2 = (logDescription: LogDescription): EventArgs => {
  return parseReceiptArgs(logDescription.fragment.inputs, logDescription.args);
};

const parseReceiptArgs = (defs: readonly ParamType[], values: Result): EventArgs => {
  const results: Record<string, any> = {};
  defs.forEach((def, index) => {
    const value = values[index];
    const result = parseReceiptArg(def, value);
    results[def.name] = result;
  });
  return results;
};

const parseReceiptArg = (def: ParamType, value: Result): EventArgValue => {
  if (def.components && def.components.length > 0) {
    return parseReceiptArgs(def.components, value);
  } else {
    return value;
  }
};

export enum EthereumChain {
  Mainnet = 1,
  Goerli = 5,
}

export const SECONDS_PER_HOUR = 60 * 60;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * 24;
export const SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;

export const MILLIS_PER_MINUTE = 1000 * 60;
export const MILLIS_PER_HOUR = MILLIS_PER_MINUTE * 60;
export const MILLIS_PER_DAY = MILLIS_PER_HOUR * 24;

export function bytesToHex(value: Uint8Array): string {
  return `0x${Buffer.from(value).toString('hex')}`;
}

export function hexToBytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value.replace(/^0x/, ''), 'hex'));
}

export function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
