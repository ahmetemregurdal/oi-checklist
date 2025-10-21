import { spawn } from 'child_process';
import { root } from '@config';
import path from 'path';
import type { Prisma, UserProblemData, VirtualSubmission } from '@prisma/client';

export const ojuz = {
  async verify(cookie: string) {
    return new Promise<{ error?: string, username?: string }>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/ojuz/verify.py'), cookie],
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

  async fetchProblemScores(cookie: string, username: string, problems: Prisma.ProblemGetPayload<{ include: { problemLinks: true } }>[]) {
    return new Promise<{ error?: string, scores?: UserProblemData[] }>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/ojuz/fetchProblemScores.py')],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
      proc.stdin.write(JSON.stringify({ cookie, username, problems }));
      proc.stdin.end();
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        const json = JSON.parse(out);
        res({ scores: json.scores ?? null, error: json.error ?? null });
      });
    });
  },

  async fetchContestScores(username: string, contest: Prisma.ActiveVirtualContestGetPayload<{
    include: {
      contest: {
        include: {
          problems: {
            include: {
              problem: {
                include: { problemLinks: true }
              }
            }
          }
        }
      }
    }
  }>) {
    return new Promise<{ error?: string, submissions?: VirtualSubmission[] }>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/ojuz/fetchContestScores.py')],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
      proc.stdin.write(JSON.stringify({ username, contest }));
      proc.stdin.end();
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => {
        const json = JSON.parse(out);
        res({ submissions: json.submissions ?? null, error: json.error ?? null });
      });
    });
  }
};