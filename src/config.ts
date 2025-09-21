import path from 'path';
import dotenv from 'dotenv';

export const Olympiads = new Set([
  'apio',        'bkoi',        'boi',       'ceoi',
  'coi',         'egoi',        'ejoi',      'gks',
  'inoi',        'ioi',         'ioitc',     'izho',
  'joifr',       'joioc',       'joisc',     'noifinal',
  'noiprelim',   'noiqual',     'noisel',    'poi',
  'roi',         'usacobronze', 'usacogold', 'usacoplatinum',
  'usacosilver', 'zco',
]);

export const Platforms = new Set([
  'atcoder',    'baekjoon',   'cms',        'codebreaker',
  'codechef',   'codedrills', 'codeforces', 'dmoj',
  'oj.uz',      'qoj.ac',     'szkopuł',    'usaco',
]);

export const HostnameToPlatform: Record<string, string> = {
  'acmicpc.net'       : 'baekjoon',
  'atcoder.jp'        : 'atcoder',
  'cms.iarcs.org.in'  : 'cms',
  'codebreaker.xyz'   : 'codebreaker',
  'codechef.com'      : 'codechef',
  'codedrills.io'     : 'codedrills',
  'codeforces.com'    : 'codeforces',
  'dmoj.ca'           : 'dmoj',
  'icpc.codedrills.io': 'codedrills',
  'oj.uz'             : 'oj.uz',
  'qoj.ac'            : 'qoj.ac',
  'szkopul.edu.pl'    : 'szkopuł',
  'usaco.org'         : 'usaco' 
}

export const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(root, '.env') });

function validateEnv(key: string) {
  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} is not set. You may want to check your .env`);
  }
  return process.env[key];
}

export const GithubClientId      = validateEnv('GITHUB_CLIENT_ID');
export const GithubClientSecret  = validateEnv('GITHUB_CLIENT_SECRET');
export const GoogleClientId      = validateEnv('GOOGLE_CLIENT_ID');
export const GoogleClientSecret  = validateEnv('GOOGLE_CLIENT_SECRET');
export const DiscordClientId     = validateEnv('DISCORD_CLIENT_ID');
export const DiscordClientSecret = validateEnv('DISCORD_CLIENT_SECRET');

export const RootUrl = validateEnv('ROOT_URL');