export function hexToBytes(str: string): Uint8Array {
    if (str.startsWith('0x')) {
        str = str.slice(2);
    }
    return Uint8Array.from(Buffer.from(str, 'hex'));
}

export function bytesToHex(bytes: Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex');
}
