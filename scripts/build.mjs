// build.mjs — content + apps + data → site/
//
// やること
//   1. 記事を HTML にする
//   2. 概念語の初出に、canon.yml が指す正典へのリンクを張る
//   3. 記事末尾に「関連」ブロックを自動生成する（related の先 + 逆リンク）
//   4. 概念ごとの索引ページを作る
//   5. 全アプリへ配るリンク JSON を出す
//   6. サイトマップを作る（public のみ。preview は載せない）

import fs from 'node:fs';
import { marked } from 'marked';
import { loadData, loadContent, makeResolver, docUrl, esc, write, copyDir, p } from './lib.mjs';

const SITE = p('site');
const SECTION_LABEL = { articles: '論考', frameworks: '概念', stories: '物語', reports: 'レポート' };

// トップページに並べるジャンルと、その順番
const GENRE_ORDER = ['診断', 'シミュレーター', '絵本', '物語', '論考', '概念', 'レポート', '自己紹介', '思索の目次'];
const GENRE_NOTE = {
  '診断': '問いに答えると、自分の位置が地形として出ます',
  'シミュレーター': '数字を生活の実感に翻訳します',
  '絵本': 'タップして読む絵本',
  '物語': '概念を物語に翻訳したもの',
  '論考': '書いたもの',
  '概念': '松村モデルの各概念',
  'レポート': '調査と分析',
  '自己紹介': 'どういう人間が書いているか',
  '思索の目次': '全体の地図',
};

// YAML の日付は Date に変換されるので、表示用に整える
const fmtDate = (d) => {
  if (!d) return '';
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toISOString().slice(0, 10);
};

const data = loadData();
const docs = loadContent();
const resolve = makeResolver(data, docs);

// 公開対象を絞る。draft と paid はサイトに出さない
const publish = docs.filter((d) => d.status === 'public' || d.status === 'preview');
const publicDocs = publish.filter((d) => d.status === 'public');

// ---------- 逆リンクの索引をつくる ----------
const backlinks = new Map();
const addBack = (target, from) => {
  if (!backlinks.has(target)) backlinks.set(target, new Set());
  backlinks.get(target).add(from);
};
for (const d of publish) for (const r of d.related || []) addBack(r, d.id);

// ---------- 概念の自動リンク ----------
// HTML のタグの外側だけを対象にし、概念ごとに最初の1回だけ置き換える
function autolinkConcepts(html, selfId) {
  const entries = [];
  for (const [name, def] of Object.entries(data.canon)) {
    if (!def || !def.canonical || def.canonical === selfId) continue;
    const target = resolve.get(def.canonical);
    if (!target || !target.url) continue;
    for (const term of [name, ...(def.aliases || [])]) entries.push({ term, url: target.url, name });
  }
  entries.sort((a, b) => b.term.length - a.term.length); // 長い語から先に

  const done = new Set();
  const parts = html.split(/(<[^>]+>)/g);
  let inAnchor = false;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (seg.startsWith('<')) {
      if (/^<a\b/i.test(seg)) inAnchor = true;
      else if (/^<\/a>/i.test(seg)) inAnchor = false;
      continue;
    }
    if (inAnchor || !seg.trim()) continue;
    let s = seg;
    for (const e of entries) {
      if (done.has(e.name)) continue;
      const idx = s.indexOf(e.term);
      if (idx === -1) continue;
      s = s.slice(0, idx) + `<a class="concept" href="${e.url}">${e.term}</a>` + s.slice(idx + e.term.length);
      done.add(e.name);
    }
    parts[i] = s;
  }
  return parts.join('');
}

// ---------- 関連ブロック ----------
function relatedBlock(doc) {
  const ids = new Set([...(doc.related || []), ...(backlinks.get(doc.id) || [])]);
  if (doc.external) ids.add(doc.external);
  const items = [];
  for (const id of ids) {
    const t = resolve.get(id);
    if (!t || !t.url) continue;
    if (t.source === 'content' && t.status !== 'public') continue;
    const ext = /^https?:/.test(t.url);
    items.push(
      `<li><a href="${esc(t.url)}"${ext ? ' rel="noopener"' : ''}>${esc(t.title || id)}</a>` +
        (ext ? ' <span class="ext">外部</span>' : '') +
        `</li>`
    );
  }
  if (!items.length) return '';
  return `\n<nav class="related"><h2>関連</h2><ul>${items.join('')}</ul></nav>\n`;
}

// ---------- ページの外枠 ----------
function page({ title, body, noindex = false, desc = '' }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
${noindex ? '<meta name="robots" content="noindex,nofollow">\n' : ''}<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">\n` : ''}<meta property="og:title" content="${esc(title)}">
<link rel="stylesheet" href="/shared/base.css">
</head>
<body>
<div class="page">
<header class="site-header"><a href="/">松村有晃</a></header>
<main>
${body}
</main>
<footer class="site-footer"><a href="/">目次へ</a></footer>
</div>
<script src="/shared/links.js" defer></script>
<script src="/shared/qr-share.js" defer></script>
</body>
</html>`;
}

// ---------- 記事を書き出す ----------
let count = 0;
for (const d of publish) {
  let html = marked.parse(d.body);
  html = autolinkConcepts(html, d.id);
  const preview = d.status === 'preview';
  const body =
    `<article class="doc">` +
    `<div class="meta"><span class="kind">${d.genre || SECTION_LABEL[d.section] || d.section}</span>` +
    (d.date ? `<time datetime="${esc(fmtDate(d.date))}">${esc(fmtDate(d.date))}</time>` : '') +
    (preview ? `<span class="badge-preview">仮公開</span>` : '') +
    `</div>` +
    `<h1>${esc(d.title)}</h1>` +
    html +
    relatedBlock(d) +
    `</article>`;
  const url = docUrl(d);
  write(`site${url}index.html`, page({ title: d.title, body, noindex: preview, desc: d.summary || '' }));
  count++;
}

// ---------- 概念ごとの索引 ----------
for (const [name, def] of Object.entries(data.canon)) {
  const hits = [];
  for (const d of publicDocs) if ((d.concepts || []).includes(name)) hits.push({ title: d.title, url: docUrl(d) });
  for (const [id, v] of Object.entries(data.registry))
    if ((v.concepts || []).includes(name)) hits.push({ title: v.title, url: v.url });
  for (const [id, v] of Object.entries(data.links))
    if ((v.concepts || []).includes(name)) hits.push({ title: v.title, url: v.url, ext: true });
  if (!hits.length) continue;
  const list = hits
    .map((h) => `<li><a href="${esc(h.url)}">${esc(h.title)}</a>${h.ext ? ' <span class="ext">外部</span>' : ''}</li>`)
    .join('');
  const body = `<article class="doc"><div class="meta"><span class="kind">概念</span></div><h1>${esc(name)}</h1>${
    def?.detail ? `<p class="detail">${esc(def.detail)}</p>` : ''
  }<ul class="index-list">${list}</ul></article>`;
  write(`site/c/${encodeURIComponent(name)}/index.html`, page({ title: `${name} — 索引`, body }));
}

// ---------- トップページ ----------
const topItems = [];
for (const v of Object.values(data.registry)) {
  if (v.status === 'public' && v.url && v.genre) topItems.push({ genre: v.genre, title: v.title, url: v.url, note: v.summary });
}
for (const d of publicDocs) {
  topItems.push({ genre: d.genre || SECTION_LABEL[d.section] || d.section, title: d.title, url: docUrl(d), note: d.summary, date: fmtDate(d.date) });
}
for (const v of Object.values(data.links)) {
  if (v.top && v.genre && v.url) topItems.push({ genre: v.genre, title: v.title, url: v.url, note: v.role, ext: true });
}

const genreSection = (g) => {
  const list = topItems.filter((x) => x.genre === g);
  if (!list.length) return '';
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `<section class="index-sec"><h2>${esc(g)}</h2>` +
    (GENRE_NOTE[g] ? `<p class="sec-note">${esc(GENRE_NOTE[g])}</p>` : '') +
    `<ul class="index-list">` +
    list.map((x) =>
      `<li><a href="${esc(x.url)}"${x.ext ? ' rel="noopener"' : ''}>${esc(x.title)}</a>` +
      (x.ext ? ' <span class="ext">note</span>' : '') +
      (x.note ? `<div class="item-note">${esc(x.note)}</div>` : '') +
      `</li>`).join('') +
    `</ul></section>`;
};

const topBody =
  `<h1 class="site-title">思想と実践</h1>` +
  `<p class="site-lead">概念を組み、診断にし、物語にし、20年ぶんの記録と一緒に置いています。</p>` +
  GENRE_ORDER.map(genreSection).join('') +
  `<section class="index-sec"><h2>archive</h2>` +
  `<p class="sec-note">2005年から書き続けた記録</p>` +
  `<ul class="index-list">` +
  `<li><a href="/archive/">旧ブログ 2005–2026</a><div class="item-note">1,273本・724,131文字</div></li>` +
  `</ul></section>`;
write('site/index.html', page({ title: '松村有晃 — 思想と実践', body: topBody }));
// ---------- アプリと共通ファイルを配置 ----------
// apps は 20MB 超あるので、毎回のローカルビルドでは複製しない。
// ローカルの確認は dev サーバーが apps/ を直接配信する。CI では COPY_APPS=1 で複製する。
// 公開先は /<name>/（短い住所）。apps/<name>/ が原本で、site/<name>/ に複製する。
const APP_NAMES = fs.readdirSync(p('apps'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
if (process.env.COPY_APPS === '1' || process.argv.includes('--full')) {
  for (const a of APP_NAMES) copyDir(p('apps/' + a), p('site/' + a));
}
copyDir(p('shared'), p('site/shared'));

// ---------- 全アプリに QR 共有ボタンを差し込む ----------
// apps/ の原本は触らず、公開用の複製（site/<name>/）にだけ <script> を足す。
// 新しいアプリを足しても、ここで自動的にボタンが付く。
const QR_TAG = '<script src="/shared/qr-share.js" defer></script>';
// 右上のボタンが他のUIと重なるアプリは、ここで位置を変える（top-left / none）。none は右上を出さず、最下部のボタンだけにする
const QR_POS = { chugo: 'none' };
function injectQr(dir, app) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = dir + '/' + e.name;
    if (e.isDirectory()) { n += injectQr(f, app); continue; }
    if (!e.isFile() || !/\.html?$/i.test(e.name)) continue;
    if (/admin|debug/i.test(e.name)) continue;
    const t = fs.readFileSync(f, 'utf8');
    if (t.includes('/shared/qr-share.js')) continue;
    const i = t.toLowerCase().lastIndexOf('</body>');
    const tag = QR_POS[app] ? QR_TAG.replace(' defer>', ` data-pos="${QR_POS[app]}" defer>`) : QR_TAG;
    fs.writeFileSync(f, i >= 0 ? t.slice(0, i) + tag + '\n' + t.slice(i) : t + '\n' + tag + '\n');
    n++;
  }
  return n;
}
let qrInjected = 0;
for (const a of APP_NAMES) qrInjected += injectQr(p('site/' + a), a);

// ---------- 旧住所（/apps/<name>/…、/-happiness-map/…）から新住所へ飛ばす ----------
// 旧リンクが生き続けるようにする。クエリとハッシュは引き継ぐ。
function stub(to) {
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="robots" content="noindex">` +
    `<link rel="canonical" href="https://kuniakimat.com${to}"><title>移動しました</title>` +
    `<script>location.replace(${JSON.stringify(to)}+location.search+location.hash)</script>` +
    `<noscript><meta http-equiv="refresh" content="0;url=${to}"></noscript>` +
    `<p><a href="${to}">新しい住所へ</a></p></html>`;
}
let stubs = 0;
for (const a of APP_NAMES) {
  const src = p('apps/' + a);
  const prefixes = ['apps/' + a].concat(a === 'happiness-map' ? ['-happiness-map'] : []);
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { walk(d + '/' + e.name, rel + e.name + '/'); continue; }
      if (!/\.html?$/i.test(e.name)) continue;
      const isIndex = /^index\.html?$/i.test(e.name);
      const to = '/' + a + '/' + rel + (isIndex ? '' : e.name);
      for (const pre of prefixes) {
        write('site/' + pre + '/' + rel + e.name, stub(to));
        if (isIndex) write('site/' + pre + '/' + rel + 'index.html', stub(to));
        stubs++;
      }
    }
  })(src, '');
}

// ---------- QR 一覧ページ（会食で見せる用。台帳から自動生成） ----------
{
  const tpl = fs.readFileSync(p('scripts/qr-hub.template.html'), 'utf8');
  const apps = Object.values(data.registry)
    .filter((v) => v.status === 'public' && v.url && /^\/[^/]+\/(report\/)?$/.test(v.url) && APP_NAMES.includes(v.url.split('/')[1]))
    .map((v) => ({ name: v.title, desc: v.genre || '', url: v.url }));
  write('site/qr/index.html', tpl.replace('/*APPS_JSON*/[]', JSON.stringify(apps)));
}

// 独自ドメインと Jekyll 無効化の指定を生成物へ持っていく
if (fs.existsSync(p('CNAME'))) write('site/CNAME', fs.readFileSync(p('CNAME'), 'utf8'));
write('site/.nojekyll', '');

// ---------- 全アプリへ配るリンクデータ ----------
const nav = Object.values(data.registry)
  .filter((v) => v.status === 'public' && v.url)
  .map((v) => ({ title: v.title, url: v.url }));
write('site/shared/links.json', JSON.stringify({ nav, updated: new Date().toISOString() }, null, 2));

// ---------- サイトマップ（public のみ） ----------
const urls = [
  '/',
  ...publicDocs.map(docUrl),
  ...Object.values(data.registry).filter((v) => v.status === 'public' && v.url).map((v) => v.url),
];
write(
  'site/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>https://kuniakimat.com${u}</loc></url>`).join('\n') +
    `\n</urlset>\n`
);
write('site/robots.txt', `User-agent: *\nDisallow: /p/\nSitemap: https://kuniakimat.com/sitemap.xml\n`);

console.log(`build: 記事 ${count}件 / 公開 ${publicDocs.length}件 / 仮公開 ${publish.length - publicDocs.length}件`);
console.log(`       QRボタン差し込み ${qrInjected}ページ・旧住所の転送 ${stubs}ページ`);
console.log(`       概念索引 ${Object.keys(data.canon).length}件 / アプリ ${nav.length}件`);

// ---------- 旧ブログ archive ----------
await import('./build_archive.mjs');
