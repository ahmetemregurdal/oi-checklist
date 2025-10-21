import { spawn } from 'child_process';
import { root } from '@config';
import path from 'path';
import { UserProblemData } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export const ojuz = {
  async verify(cookie: string) {
    const data: {
      username?: string;
      error?: string
    } = {};
    return new Promise<typeof data>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/verifyOjuz.py'), cookie],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        const json = JSON.parse(out);
        res({ username: json.username ?? null, error: json.error ?? null })
      });
    });
  },

  async fetchScores(cookie: string, username: string, problems: Prisma.ProblemGetPayload<{ include: { problemLinks: true } }>[]) {
    const data: {
      error?: string;
      scores?: UserProblemData[]
    } = {};
    return new Promise<typeof data>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/fetchScores.py')],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.stdin.write(JSON.stringify({ cookie, username, problems }));
      proc.stdin.end();
      proc.on('close', () => {
        const json = JSON.parse(out);
        res({ scores: json.scores ?? null, error: json.error ?? null });
      });
    });
  }
};