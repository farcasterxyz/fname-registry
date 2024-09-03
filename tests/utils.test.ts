import { bytesToHex, hexToBytes, currentTimestamp, decodeDnsName } from '../src/util.js';

describe('bytesToHex', () => {
  it('should convert Uint8Array to hex string', () => {
    const input = new Uint8Array([1, 2, 3, 255]);
    const expectedOutput = '0x010203ff';
    expect(bytesToHex(input)).toBe(expectedOutput);
  });

  it('should handle an empty Uint8Array', () => {
    const input = new Uint8Array([]);
    const expectedOutput = '0x';
    expect(bytesToHex(input)).toBe(expectedOutput);
  });

  it('should handle a single byte', () => {
    const input = new Uint8Array([255]);
    const expectedOutput = '0xff';
    expect(bytesToHex(input)).toBe(expectedOutput);
  });
});

describe('hexToBytes', () => {
  it('should convert a hex string to Uint8Array', () => {
    const input = '0x010203ff';
    const expectedOutput = new Uint8Array([1, 2, 3, 255]);
    expect(hexToBytes(input)).toEqual(expectedOutput);
  });

  it('should handle a hex string without the 0x prefix', () => {
    const input = '010203ff';
    const expectedOutput = new Uint8Array([1, 2, 3, 255]);
    expect(hexToBytes(input)).toEqual(expectedOutput);
  });

  it('should return an empty Uint8Array for an empty string', () => {
    const input = '';
    const expectedOutput = new Uint8Array([]);
    expect(hexToBytes(input)).toEqual(expectedOutput);
  });

  it('should handle a single byte hex string', () => {
    const input = '0xff';
    const expectedOutput = new Uint8Array([255]);
    expect(hexToBytes(input)).toEqual(expectedOutput);
  });
});

describe('currentTimestamp', () => {
  it('should return the current timestamp in seconds', () => {
    const before = Math.floor(Date.now() / 1000);
    const timestamp = currentTimestamp();
    const after = Math.floor(Date.now() / 1000);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should return an integer value', () => {
    const timestamp = currentTimestamp();
    expect(Number.isInteger(timestamp)).toBe(true);
  });
});

describe('decodeDnsName', () => {
  it('should decode a DNS name from a hex string', () => {
    const input = '0x03777777076578616d706c6503636f6d00';
    const expectedOutput = ['www', 'example', 'com'];
    expect(decodeDnsName(input)).toEqual(expectedOutput);
  });

  it('should handle a DNS name with a single label', () => {
    const input = '0x096c6f63616c686f737400';
    const expectedOutput = ['localhost'];
    expect(decodeDnsName(input)).toEqual(expectedOutput);
  });

  it('should handle a DNS name with multiple labels including subdomains', () => {
    const input = '0x0373756206646f6d61696e076578616d706c6503636f6d00';
    const expectedOutput = ['sub', 'domain', 'example', 'com'];
    expect(decodeDnsName(input)).toEqual(expectedOutput);
  });

  it('should throw an error if the input is not properly formatted', () => {
    const input = '0x03777777';
    expect(() => decodeDnsName(input)).toThrow();
  });
});
