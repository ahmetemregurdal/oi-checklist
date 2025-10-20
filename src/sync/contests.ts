import fs from 'fs/promises';
import readline from 'readline/promises';
import { stdin, stdout } from 'process';
import YAML from 'yaml';
import path from 'path';
import { root } from '@config';
import { db } from '@db';

interface ContestYAML {
  name: string;
  stage?: string;
  location?: string;
  duration?: number;
  source: string;
  year: number;
  date?: string;
  website?: string;
  link?: string;
  note?: string;
  scores?: Record<string, number[]>;
  medalCutoffs?: Record<string, number>;
  problems?: {
    source: string;
    year: number;
    number: number;
    extra?: string;
    id?: number;
  }[];
}

async function parseFile(dir: string, file: string) {
  let contest = YAML.parse(await fs.readFile(path.join(dir, file), 'utf8')) as ContestYAML;
  contest = { ...contest, year: parseInt(file.replace(/\.yaml$/i, '')) };

  // a corresponding scores_[].json might exist
  const jsonFile = `scores_${file.replace(/\.ya?ml$/i, '')}.json`;
  const jsonPath = path.join(dir, jsonFile);
  try {
    await fs.access(jsonPath, fs.constants.F_OK);
    contest.scores = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as Record<string, number[]>;
  } catch {
  }

  return contest;
}

async function main() {
  const sources = (await fs.readdir(path.resolve(root, 'data/contests'), { withFileTypes: true })).filter(i => i.isDirectory()).map(i => i.name);
  let contests: ContestYAML[] = [];
  for (const source of sources) {
    const dir = path.resolve(path.resolve(root, 'data/contests'), source);
    const fsdir = await fs.readdir(dir, { withFileTypes: true });
    const yamlFiles = fsdir.filter(i => i.isFile() && i.name.endsWith('.yaml')).map(i => i.name);
    const folders = fsdir.filter(i => i.isDirectory()).map(i => i.name);
    // source/year.yaml
    const i = (await Promise.all(
      yamlFiles.map(file => parseFile(dir, file))
    )).map(i => ({ ...i, source: source }));
    contests.push(...i);
    // source/year/extra.yaml
    for (const year of folders) {
      const subdir = path.resolve(dir, year);
      const yamlFiles = (await fs.readdir(subdir, { withFileTypes: true })).filter(i => i.isFile() && i.name.endsWith('.yaml')).map(i => i.name);
      const i = await Promise.all(
        yamlFiles.map(async file => {
          const contest = await parseFile(subdir, file);
          return {
            ...contest,
            source,
            year: parseInt(year),
            stage: file.replace(/\.yaml$/i, '').replace(/_/g, ' '),
          };
        })
      );
      contests.push(...i);
    }
  }

  console.log(`Found ${contests.length} contests in .yaml files`);

  // so we don't nuke contests without warning
  const keys = new Set(contests.map(i => i.stage ? `${i.name}|${i.stage}` : i.name));
  const dbKeys = (await db.contest.findMany({ select: { name: true, stage: true } })).map(i => ({
    name: i.name, stage: i.stage,
    key: i.stage ? `${i.name}|${i.stage}` : i.name
  }));
  const missing = dbKeys.filter(i => !keys.has(i.key)).map(i => ({
    name: i.name, stage: i.stage
  }));
  if (missing.length > 0) {
    console.warn(`Found ${missing.length} contests in database not in yaml:`);
    console.log(missing);
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const ans = await rl.question('Type "yes" to delete them: ');
    rl.close();
    if (ans == 'yes') {
      await db.problem.deleteMany({
        where: {
          OR: missing.map(i => {
            return i.stage ? { name: i.name, stage: i.stage } : { name: i.name }
          })
        }
      });
      console.log(`Deleted ${missing.length} problems`);
    }
  }

  // verify that all problems referred to in the contests actually exist
  for (let contest of contests) {
    for (let problem of contest.problems) {
      const dbProblem = await db.problem.findUnique({
        where: {
          source_year_number_extra: {
            source: problem.source,
            year: problem.year,
            number: problem.number,
            extra: problem.extra ?? ''
          }
        }
      });
      if (!dbProblem) {
        console.warn(`Error: the following problem is not in the database. Did you forget to run problems.ts?\n`, problem);
        throw new Error('Aborting due to data invalidity');
      }
      problem.id = dbProblem.id;
    }
  }

  await Promise.all(contests.map(async i => {
    const update = {
      name: i.name,
      stage: i.stage ?? '',
      ...(i.location ? { location: i.location } : {}),
      ...(i.duration ? { duration: i.duration } : {}),
      source: i.source,
      year: i.year,
      ...(i.date ? { date: i.date } : {}),
      ...(i.website ? { website: i.website } : {}),
      ...(i.link ? { link: i.link } : {}),
      ...(i.note ? { note: i.note } : {})
    };
    // create contest
    const contest = await db.contest.upsert({
      where: { name_stage: { name: i.name, stage: i.stage ?? '' } },
      update, create: update
    });
    let idx = 0;
    // insert contest-problem links
    for (const problem of i.problems) {
      const data = { contestId: contest.id, problemId: problem.id, problemIndex: idx };
      await db.contestProblem.upsert({
        where: { contestId_problemId: { contestId: contest.id, problemId: problem.id } },
        update: data, create: data
      });
      idx++;
    }
    // add contest scores + medal cutoffs
    interface ContestScoreData {
      contestId: number,
      medalNames: string[];
      medalCutoffs: number[];
      problemScores: Record<string, number[]>;
    };
    let data: ContestScoreData = { contestId: contest.id, medalNames: [], medalCutoffs: [], problemScores: i.scores };
    for (const [medal, cutoff] of Object.entries(i.medalCutoffs)) {
      data.medalNames.push(medal);
      data.medalCutoffs.push(cutoff);
    }
    await db.contestScores.upsert({
      where: { contestId: contest.id },
      update: data, create: data
    });
  }));

  console.log(`Updated database; new count: ${await db.contest.count()}`);
}

main().catch((err) => {
  console.error('Fatal error: ', err);
  process.exit(1);
});