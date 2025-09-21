import path from 'path';

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