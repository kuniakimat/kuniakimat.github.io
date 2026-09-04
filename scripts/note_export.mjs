// note_export.mjs — チャネル別の貼り付け用テキストを out/ に生成する
//
// 原本は content/ の1本のまま。出力先ごとに形だけ変えて配る。
// front matter の distribute で、記事ごとの出し分けを指定する。
//
//   note: full  全文＋末尾に自サイトの原典リンクと関連アプリ
//   note: lead  導入だけ出して自サイトへ送る（診断・グラフ・絵本向け）
//   note: paid  有料記事として出す（サイトには出さない）
//   note: skip  自サイトのみ
//   x: card     図1枚＋抜粋＋リンクの投稿文
//
// 公開後に本文を直した場合、note に出した版との差分を検出して一覧に出す。

import fs from 'node:fs';
import crypto from 'node:crypto';
import { p, loadData, loadContent, makeResolver, docUrl, write } from './lib.mjs';

const SITE = 'https://kuniakimat.com';
const data = loadData();
const docs = loadContent();
const resolve = makeResolver(data, docs);

const stateFile = p('data/.note-state.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const nextState = { ...state };

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

const relatedLines = (d) => {
  const out = [];
  for (const id of d.related || []) {
    const t = resolve.get(id);
    if (!t || !t.url) continue;
    const url = /^https?:/.test(t.url) ? t.url : SITE + t.url;
    out.push(`・${t.title || id}\n${url}`);
  }
  return out;
};

const needsRepost = [];
let made = 0;

for (const d of docs) {
  const mode = d.distribute?.note || 'skip';
  const canonical = SITE + docUrl(d);

  // ---- note 用 ----
  if (mode !== 'skip' && (d.status === 'public' || d.status === 'paid')) {
    let text = '';
    if (mode === 'lead') {
      const lead = d.body.trim().split(/\n\s*\n/).slice(0, 3).join('\n\n');
      text =
        `${d.title}\n\n${lead}\n\n———\n\n` +
        `続きと、実際に動かせる版はこちらに置いています。\n${canonical}\n`;
    } else {
      text = `${d.title}\n\n${d.body.trim()}\n\n———\n\n原典（更新はこちらが最新）\n${canonical}\n`;
    }
    const rel = relatedLines(d);
    if (rel.length) text += `\n関連\n${rel.join('\n\n')}\n`;
    if (mode === 'paid') text = `［有料記事として投稿する］\n\n` + text;

    write(`out/note/${d.slug}.txt`, text);
    made++;

    // 差分の検出
    const h = hash(d.body);
    const prev = state[d.id];
    if (prev && prev.hash !== h && prev.posted) {
      needsRepost.push({ id: d.id, title: d.title, url: prev.noteUrl || d.external || '(URL未登録)' });
    }
    nextState[d.id] = { hash: h, posted: prev?.posted || false, noteUrl: prev?.noteUrl || null };
  }

  // ---- X 用 ----
  if (d.distribute?.x === 'card' && d.status === 'public') {
    const hook = (d.summary || d.body.trim().split('\n').find((l) => l.trim() && !l.startsWith('#')) || d.title)
      .replace(/[#*_`]/g, '')
      .slice(0, 100);
    write(`out/x/${d.slug}.txt`, `${hook}\n\n${canonical}\n`);
  }

  // ---- Facebook 用（個人的な前置きを足す欄を空けておく） ----
  if (d.distribute?.facebook && d.distribute.facebook !== 'skip' && d.status !== 'draft') {
    write(
      `out/facebook/${d.slug}.txt`,
      `［ここに、友人向けの前置きを一段落］\n\n${d.title}\n${canonical}\n`
    );
  }
}

fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2));

console.log(`\nnote_export: ${made}件の貼り付け用テキストを out/ に出しました。`);
if (needsRepost.length) {
  console.log(`\n【note の貼り直しが必要な記事】`);
  for (const r of needsRepost) console.log(`  ・${r.title}\n    ${r.url}`);
  console.log(`\n貼り直したら data/.note-state.json の posted を true のままにしておいてください。`);
} else {
  console.log(`貼り直しが必要な記事はありません。\n`);
}
