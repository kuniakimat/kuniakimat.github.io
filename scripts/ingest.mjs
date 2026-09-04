// ingest.mjs — content/_inbox/ の素案を取り込んで content/articles/ へ昇格させる
//
// どのAIで作った素案でも、front matter が 5行あれば受け取れる。
// ここで ID の採番、概念の照合、台帳への登録、ファイルの移動をまとめて行う。

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { p, loadData, loadContent } from './lib.mjs';

const INBOX = p('content/_inbox');
const data = loadData();
const existing = new Set(loadContent().map((d) => d.id));

if (!fs.existsSync(INBOX)) {
  console.log('_inbox がありません');
  process.exit(0);
}

const files = fs.readdirSync(INBOX).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
if (!files.length) {
  console.log('_inbox は空です');
  process.exit(0);
}

/** タイトルから ID の候補を作る（日本語はローマ字化できないので日付＋連番で補う） */
function makeId(title, date) {
  const ascii = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const base = ascii && ascii.length > 2 ? `art-${ascii}` : `art-${String(date).replace(/-/g, '')}`;
  let id = base;
  let n = 2;
  while (existing.has(id)) id = `${base}-${n++}`;
  existing.add(id);
  return id;
}

/** 本文に現れる概念語を canon.yml から拾う */
function detectConcepts(text) {
  const found = new Set();
  for (const [name, def] of Object.entries(data.canon)) {
    const terms = [name, ...((def && def.aliases) || [])];
    if (terms.some((t) => text.includes(t))) found.add(name);
  }
  return [...found];
}

const today = new Date().toISOString().slice(0, 10);
let moved = 0;

for (const name of files) {
  const src = path.join(INBOX, name);
  const { data: fm, content } = matter(fs.readFileSync(src, 'utf8'));

  const title = fm.title || name.replace(/\.md$/, '');
  const date = fm.date || today;
  const id = fm.id || makeId(title, date);
  const detected = detectConcepts(content);
  const concepts = [...new Set([...(fm.concepts || []), ...detected])];

  const front = {
    id,
    title,
    date,
    concepts,
    related: fm.related || [],
    status: fm.status && fm.status !== 'draft' ? fm.status : 'draft',
    distribute: fm.distribute || { note: 'lead', x: 'skip', facebook: 'skip' },
    source: fm.source || 'unknown',
  };
  if (fm.external) front.external = fm.external;
  if (fm.summary) front.summary = fm.summary;

  const slug = id.replace(/^art-/, '');
  const dest = p('content/articles', `${slug}.md`);
  fs.writeFileSync(dest, `---\n${yaml.dump(front, { lineWidth: 0 })}---\n\n${content.trim()}\n`);

  // 元ファイルは消さずに済ませる（削除しない方針）
  const doneDir = p('content/_inbox/_done');
  fs.mkdirSync(doneDir, { recursive: true });
  fs.renameSync(src, path.join(doneDir, name));

  console.log(`取り込み: ${name}`);
  console.log(`  → content/articles/${slug}.md`);
  console.log(`  id: ${id}`);
  console.log(`  概念: ${concepts.length ? concepts.join(', ') : '（検出なし）'}`);
  console.log(`  status: ${front.status}  ※ 仮公開にするなら preview に変える`);
  moved++;
}

console.log(`\n${moved}件を取り込みました。次は npm run build で確認してください。`);
console.log(`元ファイルは content/_inbox/_done/ に残してあります。\n`);
