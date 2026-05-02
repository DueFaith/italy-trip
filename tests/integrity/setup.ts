import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// vitest globalSetup — runs once before any test file.
// Rebuilds dist/ when any source file is newer than dist/index.html.
// astro build is ~5–10s on this site; cheap enough to run on demand.
//
// We always need dist/ for integrity tests, but unconditional rebuild on
// every `vitest run` would make the unit-test loop painful. Mtime check
// is the soft compromise: rebuild when sources changed, skip otherwise.

const ROOT = path.resolve(__dirname, '../..');

export default async function setup() {
  const distIndex = path.join(ROOT, 'dist/index.html');
  let needRebuild = true;
  if (fs.existsSync(distIndex)) {
    const distMtime = fs.statSync(distIndex).mtimeMs;
    const sources = walk(path.join(ROOT, 'src'));
    if (sources.length > 0) {
      const newestSource = Math.max(...sources.map((p) => fs.statSync(p).mtimeMs));
      needRebuild = newestSource > distMtime;
    }
  }

  if (needRebuild) {
    console.log('[integrity setup] running astro build…');
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.log('[integrity setup] dist/ is up-to-date, skipping rebuild');
  }
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}
