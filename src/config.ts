import path from 'path';
import dotenv from 'dotenv';
import { spawnSync } from 'child_process';

export const Olympiads = new Set([
  'apio', 'bkoi', 'boi', 'ceoi',
  'coi', 'egoi', 'ejoi', 'gks',
  'inoi', 'ioi', 'ioitc', 'izho',
  'joifr', 'joioc', 'joisc', 'noifinal',
  'noiprelim', 'noiqual', 'noisel', 'poi', 'rmi,
  'roi', 'usacobronze', 'usacogold', 'usacoplatinum',
  'usacosilver', 'zco', 'cnoi', 'coci'
]);

export const Platforms = new Set([
  'atcoder', 'baekjoon', 'cms', 'codebreaker',
  'codechef', 'codedrills', 'codeforces', 'dmoj',
  'oj.uz', 'qoj.ac', 'szkopuł', 'usaco',
  'eolymp'
]);

export const HostnameToPlatform: Record<string, string> = {
  'acmicpc.net': 'baekjoon',
  'atcoder.jp': 'atcoder',
  'cms.iarcs.org.in': 'cms',
  'codebreaker.xyz': 'codebreaker',
  'codechef.com': 'codechef',
  'codedrills.io': 'codedrills',
  'codeforces.com': 'codeforces',
  'dmoj.ca': 'dmoj',
  'icpc.codedrills.io': 'codedrills',
  'oj.uz': 'oj.uz',
  'qoj.ac': 'qoj.ac',
  'szkopul.edu.pl': 'szkopuł',
  'usaco.org': 'usaco',
  'eolymp.com': 'eolymp'
}

export const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(root, '.env') });

function validateEnv(key: string, fatal: boolean = true) {
  if (!process.env[key] && fatal) {
    throw new Error(`Environment variable ${key} is not set. You may want to check your .env`);
  }
  return process.env[key] ?? '';
}

export const GithubClientId = validateEnv('GITHUB_CLIENT_ID');
export const GithubClientSecret = validateEnv('GITHUB_CLIENT_SECRET');
export const GoogleClientId = validateEnv('GOOGLE_CLIENT_ID');
export const GoogleClientSecret = validateEnv('GOOGLE_CLIENT_SECRET');
export const DiscordClientId = validateEnv('DISCORD_CLIENT_ID');
export const DiscordClientSecret = validateEnv('DISCORD_CLIENT_SECRET');
export const QojUsername = validateEnv('QOJ_USER');
export const QojPassword = validateEnv('QOJ_PASS');
export const EncryptionKey = Buffer.from(validateEnv('ENCRYPTION_KEY', false), 'hex');

export const RootUrl = validateEnv('ROOT_URL');

function validatePython() {
  // check runtime
  const check = spawnSync('python3', ['--version']);
  if (check.error) {
    throw new Error('`python3` not found. Please ensure `python3` is installed and available in PATH');
  }
  const version = `v${check.stdout.toString().trim().split(' ')[1]}`;
  console.log(`[ok] python3 runtime: ${version}`);
  // check deps
  const verify = spawnSync('python3', [path.resolve(root, 'src/verify.py')], { encoding: 'utf8' });
  if (verify.error) {
    throw new Error('Failed to run verify.py. Does the file exist?');
  }
  if (verify.status != 0) {
    console.error(verify.stderr);
    throw new Error('Python dependency check failed');
  }
  console.log(verify.stdout);
}

validatePython();

type ContextField = {
  key: string;
  label: string;
  type: 'select';
  options: readonly string[];
  optionLabels: readonly string[];
};

type ContextDisplay = {
  label: string;
  negative: string;
  positive: string;
};

type ContestContext = {
  fields: readonly ContextField[];
  display: ContextDisplay;
};

const icoFields = [
  {
    key: 'gender',
    label: 'Gender',
    type: 'select',
    options: ['male', 'female'] as const,
    optionLabels: ['Male', 'Female'] as const
  },
  {
    key: 'grade',
    label: 'Grade',
    type: 'select',
    options: ['12', '11', '10', '9', '8', '7'] as const,
    optionLabels: ['12th or above', '11th', '10th', '9th', '8th', '7th or below'] as const
  }
] as const;

export const contestContexts: Record<string, ContestContext> = {
  zco: {
    fields: icoFields,
    display: {
      label: 'Qualified for INOI',
      negative: 'No',
      positive: 'Yes'
    }
  },
  inoi: {
    fields: icoFields,
    display: {
      label: 'Qualified for IOITC',
      negative: 'No',
      positive: 'Yes'
    }
  }
} as const;
