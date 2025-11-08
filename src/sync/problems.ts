import fs from 'fs/promises';
import path from 'path';
import readline from 'readline/promises';
import { stdin, stdout } from 'process';
import { root, HostnameToPlatform } from '@config';
import { db } from '@db';
import YAML from 'yaml';

interface ProblemYAML {
  name: string;
  source?: string;
  year?: number;
  number: number;
  link?: string;
  links?: (string | { platform: string; url: string })[];
  extra?: string;
}

function platform(link: string) {
  const url = new URL(link);
  const host = url.hostname.startsWith('www') ? url.hostname.slice(4) : url.hostname;
  return HostnameToPlatform[host] ?? host;
}

function parseProblem(data: ProblemYAML): ProblemYAML {
  const links = [...(data.links ?? []), ...(data.link ? [data.link] : [])].map(i => typeof i == 'string' ? { platform: platform(i), url: i } : i);
  data.links = links;
  return data;
}

async function parseFile(dir: string, file: string) {
  const problems = (YAML.parse(await fs.readFile(path.join(dir, file), 'utf8')) as ProblemYAML[]).map(i => parseProblem(i));
  return problems.map(i => ({ ...i, year: parseInt(file.replace(/\.yaml$/i, '')) }));
}

async function main() {
  const sources = (await fs.readdir(path.resolve(root, 'data/problems'), { withFileTypes: true })).filter(i => i.isDirectory()).map(i => i.name);
  let problems: ProblemYAML[] = [];
  for (const source of sources) {
    const dir = path.resolve(path.resolve(root, 'data/problems'), source);
    const fsdir = await fs.readdir(dir, { withFileTypes: true });
    const yamlFiles = fsdir.filter(i => i.isFile() && i.name.endsWith('.yaml')).map(i => i.name);
    const folders = fsdir.filter(i => i.isDirectory()).map(i => i.name);
    // source/year.yaml
    const i = (await Promise.all(
      yamlFiles.map(file => parseFile(dir, file))
    )).flat().map(i => ({ ...i, source: source }));
    problems.push(...i);
    // source/year/extra.yaml
    for (const year of folders) {
      const subdir = path.resolve(dir, year);
      const yamlFiles = (await fs.readdir(subdir, { withFileTypes: true })).filter(i => i.isFile() && i.name.endsWith('.yaml')).map(i => i.name);
      const i = (await Promise.all(yamlFiles.map(async file => (await parseFile(subdir, file)).map(p => ({
        ...p,
        source: source,
        year: parseInt(year),
        extra: file.replace(/\.yaml$/i, '').replace('_', ' ')
      }))))).flat();
      problems.push(...i);
    }
  }

  console.log(`Found ${problems.length} problems in .yaml files`);

  // so we don't nuke problems without warning
  const dbProblems = await db.problem.findMany({ select: { source: true, year: true, number: true, extra: true, name: true, problemLinks: true } });
  const keys = new Set(problems.map(i => {
    return i.number ? `${i.source}|${i.year}|${i.number}|${i.extra ?? ''}` : `${i.name}|${i.source}|${i.year}|${i.extra ?? ''}`;
  }));
  const dbKeys = dbProblems.map(i => ({
    name: i.name, source: i.source, year: i.year, number: i.number, extra: i.extra,
    key: i.number ? `${i.source}|${i.year}|${i.number}|${i.extra}` : `${i.name}|${i.source}|${i.year}|${i.extra ?? ''}`
  }));
  const missing = dbKeys.filter(i => !keys.has(i.key)).map(i => ({
    name: i.name, source: i.source, year: i.year, extra: i.extra, number: i.number
  }));
  if (missing.length > 0) {
    console.warn(`Found ${missing.length} problems in database not in yaml:`);
    console.log(missing);
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const ans = await rl.question('Type "yes" to delete them: ');
    rl.close();
    if (ans == 'yes') {
      await db.problem.deleteMany({
        where: {
          OR: missing.map(i => {
            return i.number ? { source: i.source, year: i.year, number: i.number, extra: i.extra ?? '' } : { name: i.name, source: i.source, year: i.year, extra: i.extra ?? '' };
          })
        }
      });
      console.log(`Deleted ${missing.length} problems`);
    }
  }

  await Promise.all(problems.map(async i => {
    const update = {
      name: i.name,
      number: i.number,
      source: i.source,
      year: i.year,
      extra: i.extra ?? ''
    };
    const problem = i.number ? await db.problem.upsert({
      where: {
        source_year_number_extra: { source: i.source, year: i.year, number: i.number, extra: i.extra ?? '' }
      },
      update, create: update
    }) : await db.problem.upsert({
      where: {
        name_source_year_extra: { name: i.name, source: i.source, year: i.year, extra: i.extra ?? '' }
      },
      update, create: update
    });
    for (const link of i.links) {
      const data = {
        problemId: problem.id,
        platform: (link as any).platform,
        url: (link as any).url,
      };
      await db.problemLink.upsert({
        where: {
          problemId_platform_url: data,
        },
        update: {}, create: data
      });
    }
  }));

  console.log(`Updated database; new count: ${await db.problem.count()}`);
}

main().catch((err) => {
  console.error('Fatal error: ', err);
  process.exit(1);
});