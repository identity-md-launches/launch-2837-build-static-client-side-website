import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

const root = resolve('.');
const reportPath = 'artifacts/export-check.json';
const skipped = new Set(['.git', '.github', '.imd', '.agents', '.codex', '.aws', 'node_modules', '.vite', '.cache']);
const files = [];
async function walk(relative = '') {
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (skipped.has(entry.name) || entry.name === '.env' || entry.name.startsWith('.env.') || path === 'test/scratch' || entry.name.endsWith('.tsbuildinfo') || path === reportPath) continue;
    assert.ok(!entry.isSymbolicLink(), `Unexpected submitted symlink: ${path}`);
    if (entry.isDirectory()) await walk(path);
    else {
      assert.ok(!/\.(?:tgz|tar|zip)$/i.test(path), `Unnecessary archive: ${path}`);
      files.push({ path, bytes: (await lstat(join(root, path))).size });
    }
  }
}
await walk();
for (const required of ['dist/index.html', 'src/App.tsx', 'package.json', 'package-lock.json', 'README.md', 'DESIGN.md', 'artifacts/validation.md']) {
  await access(join(root, required));
}
const html = await readFile('dist/index.html', 'utf8');
assert.ok(html.includes('<title>Book Desk'));
assert.ok(html.includes('name="description"') && html.includes('property="og:title"') && html.includes('property="og:image"'));
const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
const share = html.match(/property="og:image" content="([^"]+)"/)?.[1];
if (share) local.push(share);
for (const path of local) {
  assert.ok(path.startsWith('./'), `Asset URL must be relative: ${path}`);
  await access(join('dist', path));
}
const exported = files.filter(f => f.path.startsWith('dist/'));
for (const f of exported.filter(f => extname(f.path) === '.css')) {
  const css = await readFile(f.path, 'utf8');
  for (const match of css.matchAll(/url\((?:["']?)([^)'"\s]+)(?:["']?)\)/g)) {
    if (!match[1].startsWith('data:')) await access(resolve(dirname(f.path), match[1]));
  }
}
for (const f of exported.filter(f => extname(f.path) === '.js')) {
  const js = await readFile(f.path, 'utf8');
  assert.ok(js.includes('https://api.mancer.xyz') && js.includes('https://rpc.mainnet.chain.robinhood.com'));
  assert.ok(js.includes('0xa727e7AF47A965afD0341AfCEF7Bc3F86be876b0'));
  assert.ok(!/127\.0\.0\.1|BOOK_DESK_TEST_RPC|HTTP_PROXY/.test(js), 'A verification-only transport leaked into the export');
}
const assets = await Promise.all(exported.map(async f => ({ ...f, sha256: createHash('sha256').update(await readFile(f.path)).digest('hex') })));
const baseBytes = files.reduce((sum, f) => sum + f.bytes, 0);
const report = {
  limitBytes: 8_388_608,
  totalBytes: baseBytes,
  totalIncludesThisReport: true,
  fileCount: files.length + 1,
  distBytes: exported.reduce((sum, f) => sum + f.bytes, 0),
  relativeEntryAndFontAssets: true,
  productionUsesPublicSources: true,
  unexpectedSymlinksOrArchives: 0,
  distAssets: assets,
};
let body;
for (let i = 0; i < 8; i++) {
  body = JSON.stringify(report, null, 2) + '\n';
  const total = baseBytes + Buffer.byteLength(body);
  if (total === report.totalBytes) break;
  report.totalBytes = total;
}
assert.ok(report.totalBytes <= report.limitBytes, `Submission exceeds 8 MiB: ${report.totalBytes}`);
await mkdir('artifacts', { recursive: true });
await writeFile(reportPath, body);
console.log(`Export integrity passed. ${exported.length} runtime files, ${report.distBytes} bytes. Selected submission: ${report.totalBytes} / ${report.limitBytes} bytes, ${report.fileCount} files.`);
