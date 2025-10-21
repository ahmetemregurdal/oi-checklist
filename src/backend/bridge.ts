import { spawn } from 'child_process';
import { root } from '@config';
import path from 'path';

export const ojuz = {
  async verify(cookie: string) {
    const data: {
      valid: boolean;
      username?: string;
      error?: string
    } = { valid: false };
    return new Promise<typeof data>(res => {
      const proc = spawn('python3', [path.resolve(root, 'src/backend/python/verifyOjuz.py'), cookie], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', (ret) => {
        if (ret == 0) {
          res({ valid: true, username: JSON.parse(out).username });
        } else {
          res({ valid: false, error: JSON.parse(out).error });
        }
      });
    });
  },
};