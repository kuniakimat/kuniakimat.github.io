// linkcheck.mjs — リンク切れと未登録IDの検出
//
// 見つけるもの
//   1. related / external / concepts が台帳に無い ID を指している
//   2. 本文に生の URL が書かれている（台帳へ移すべきもの）
//   3. canon.yml の canonical が存在しない ID を指している
//   4. --remote を付けたとき、外部 URL の死活
//
// 1つでも見つかれば終了コード 1 を返す。GitHub Actions はここで公開を止める。

import { loadData, loadContent, makeResolver } from './lib.mjs';

const data = loadData();
const docs = loadContent();
const resolve = makeResolver(data, docs);
const problems = [];
const warn = [];

const known = new Set(resolve.all().map((x) => x.id));

for (const d of docs) {
  const where = d.file;

  for (const id of d.related || []) {
    if (!known.has(id)) problems.push(`${where}: related に未登録の ID「${id}」`);
  }
  if (d.external && !known.has(d.external)) {
    problems.push(`${where}: external に未登録の ID「${d.external}」`);
  }
  for (const c of d.concepts || []) {
    if (!(c in data.canon)) warn.push(`${where}: canon.yml に無い概念「${c}」（登録すると索引に載ります）`);
  }
  if (!d.title) problems.push(`${where}: title がありません`);
  if (!['draft', 'preview', 'public', 'paid'].includes(d.status)) {
    problems.push(`${where}: status「${d.status}」は使えません（draft / preview / public / paid）`);
  }

  // 本文に生の URL が書かれていないか
  const raw = d.body.match(/https?:\/\/[^\s)\]<>"]+/g) || [];
  for (const u of raw) {
    if (u.includes('note.com/kuniakimat') || u.includes('kuniakimat.github.io')) {
      warn.push(`${where}: 本文に自分の URL が直接書かれています → 台帳の ID に置き換えると自動で追随します\n    ${u}`);
    }
  }
}

// ID の重複
const seen = new Set();
for (const d of docs) {
  if (seen.has(d.id)) problems.push(`${d.file}: ID「${d.id}」が重複しています`);
  seen.add(d.id);
}

// canon.yml の指す先
for (const [name, def] of Object.entries(data.canon)) {
  if (!def || !def.canonical) continue;
  if (!known.has(def.canonical)) problems.push(`canon.yml: 概念「${name}」の canonical「${def.canonical}」が台帳にありません`);
}

// registry の related
for (const [id, v] of Object.entries(data.registry)) {
  for (const r of v.related || []) if (!known.has(r)) problems.push(`registry.yml: ${id} の related「${r}」が未登録`);
}

// 外部リンクの死活（--remote のときだけ）
if (process.argv.includes('--remote')) {
  const externals = [
    ...Object.entries(data.links).map(([id, v]) => ({ id, url: v.url })),
    ...Object.entries(data.registry).filter(([, v]) => v.legacy_url).map(([id, v]) => ({ id, url: v.legacy_url })),
  ].filter((x) => x.url && /^https?:/.test(x.url));

  for (const { id, url } of externals) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (!res.ok) warn.push(`外部リンク ${id}: HTTP ${res.status} — ${url}`);
    } catch (e) {
      warn.push(`外部リンク ${id}: 到達できません — ${url}`);
    }
    await new Promise((r) => setTimeout(r, 300)); // 相手のサーバーに配慮する
  }
}

if (warn.length) {
  console.log('\n【確認】');
  for (const w of warn) console.log('  ・' + w);
}
if (problems.length) {
  console.log('\n【要修正】');
  for (const e of problems) console.log('  ✗ ' + e);
  console.log(`\n${problems.length}件の修正が必要です。公開を止めました。\n`);
  process.exit(1);
}
console.log(`\nlinkcheck: 問題なし（記事 ${docs.length}件 / 台帳 ${known.size}件）\n`);
