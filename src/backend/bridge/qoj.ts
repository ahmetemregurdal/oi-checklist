import { Mutex } from 'async-mutex';
import { spawn } from 'child_process';
import path from 'path';
import { db } from '@db';
import { root, QojUsername, QojPassword } from '@config';

const tokenLock = new Mutex();

async function getValidSession(oldSession: string): Promise<{ session?: string, error?: string }> {
  return tokenLock.runExclusive(async () => {
    return new Promise<{ session?: string, error?: string }>((res) => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/qoj/refresh.py')],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
      proc.stdin.write(JSON.stringify({ oldSession, username: QojUsername, password: QojPassword }));
      proc.stdin.end();
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        const json = JSON.parse(out);
        res({ session: json.session ?? null, error: json.error ?? null });
      });
    });
  });
}

export const qoj = {
  async verify(cookie: string) {
    return new Promise<{ error?: string, username?: string }>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/qoj/verify.py')],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
      proc.stdin.write(JSON.stringify({ session: cookie }));
      proc.stdin.end();
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        const json = JSON.parse(out);
        res({ username: json.username ?? null, error: json.error ?? null })
      });
    });
  }
};