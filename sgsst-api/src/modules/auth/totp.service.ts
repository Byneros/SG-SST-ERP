import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TotpService {
  generateSecret() {
    const bytes = randomBytes(20);
    let bits = '';
    let output = '';
    for (const byte of bytes) {
      bits += byte.toString(2).padStart(8, '0');
      while (bits.length >= 5) {
        output += alphabet[parseInt(bits.slice(0, 5), 2)];
        bits = bits.slice(5);
      }
    }
    if (bits.length > 0) {
      output += alphabet[parseInt(bits.padEnd(5, '0'), 2)];
    }
    return output;
  }

  verify(secret: string, code: string) {
    const normalized = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) {
      return false;
    }
    const step = Math.floor(Date.now() / 30_000);
    return [-1, 0, 1].some((offset) => this.generateCode(secret, step + offset) === normalized);
  }

  otpauthUrl(email: string, secret: string) {
    const issuer = 'SG-SST ERP';
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  private generateCode(secret: string, step: number) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = createHmac('sha1', this.decodeBase32(secret)).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }

  private decodeBase32(secret: string) {
    const clean = secret.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
    let bits = '';
    const bytes: number[] = [];
    for (const char of clean) {
      const value = alphabet.indexOf(char);
      if (value < 0) continue;
      bits += value.toString(2).padStart(5, '0');
      while (bits.length >= 8) {
        bytes.push(parseInt(bits.slice(0, 8), 2));
        bits = bits.slice(8);
      }
    }
    return Buffer.from(bytes);
  }
}
