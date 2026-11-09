#!/usr/bin/env node
/**
 * Build the static Cloudflare Pages artifact in dist/.
 * Only runtime files are copied; raw CSV sources, tests and screenshots stay out.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copy(path.join(src, entry), path.join(dest, entry));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copy(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
copy(path.join(ROOT, 'src'), path.join(DIST, 'src'));
copy(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

// Runtime data only. Raw HYG/Exoplanet/SDSS CSV inputs are intentionally excluded.
const runtimeData = [
  'manifest.json', 'stars.bin', 'stars_index.json', 'exoplanets.json',
  'sdss_galaxies.bin', 'sdss_galaxies.json', 'sdss_quasars.bin', 'sdss_quasars.json',
];
for (const file of runtimeData) {
  const src = path.join(ROOT, 'data', file);
  if (!fs.existsSync(src)) throw new Error(`Missing runtime data/${file}`);
  copy(src, path.join(DIST, 'data', file));
}

fs.writeFileSync(path.join(DIST, '_headers'), `# EON — Cloudflare Pages headers
/index.html
  Cache-Control: no-cache
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/src/*
  Cache-Control: public, max-age=300, must-revalidate
  X-Content-Type-Options: nosniff

/assets/*
  Cache-Control: public, max-age=86400
  X-Content-Type-Options: nosniff

/data/*
  Cache-Control: public, max-age=86400
  X-Content-Type-Options: nosniff
`);

fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\n');

let files = 0, bytes = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
}
walk(DIST);
console.log(`dist/: ${files} files, ${(bytes / 1048576).toFixed(1)} MiB`);
