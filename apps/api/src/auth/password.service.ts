import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  // OWASP-recommended argon2id parameters (sensible defaults for 2025).
  private readonly opts: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19 * 1024, // ~19 MB
    timeCost: 2,
    parallelism: 1,
  };

  hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, this.opts);
  }

  verify(hash: string, plaintext: string): Promise<boolean> {
    return argon2.verify(hash, plaintext).catch(() => false);
  }
}
