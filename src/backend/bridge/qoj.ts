import { Mutex } from 'async-mutex';
import { spawn } from 'child_process';
import path from 'path';
import { root, QojUsername, QojPassword } from '@config';
import { Prisma, UserProblemData, VirtualSubmission } from '@prisma/client';
import { db } from '@db';

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
  },

  async fetchProblemScores(cookie: string, username: string, problems: Prisma.ProblemGetPayload<{ include: { problemLinks: true } }>[]) {
    return new Promise<{ error?: string, scores?: UserProblemData[] }>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/qoj/fetchProblemScores.py')],
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
    let token = await db.scraperAuthToken.findUnique({ where: { platform: 'qoj.ac' } });
    let res = await getValidSession(token?.token ?? '');
    if (res.error) {
      throw new Error(res.error);
    }
    await db.scraperAuthToken.upsert({
      where: { platform: 'qoj.ac' },
      update: { token: res.session },
      create: { platform: 'qoj.ac', token: res.session }
    });
    let cookie = res.session;
    return new Promise<{ error?: string, submissions?: VirtualSubmission[] }>(res => {
      const proc = spawn('python3',
        [path.resolve(root, 'src/backend/python/qoj/fetchContestScores.py')],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
      proc.stdin.write(JSON.stringify({ session: cookie, username, contest }));
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