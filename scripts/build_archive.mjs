// build_archive.mjs — 旧ブログ 1,292記事を静的ページとして書き出す
//
// 入力: data/archive/exblog.jsonl（1行1記事）
// 出力: site/archive/index.html      索引・検索
//       site/archive/<id>/index.html 記事ごとの固定URL
//
// 公開の切り替えは data/archive/config.json の public。
//   false → 検索避け（noindex）を付け、サイトマップにも載せない
//   true  → 正式公開
import fs from 'node:fs';
import { p, esc, write } from './lib.mjs';

const SRC = p('data/archive/exblog.jsonl');
if (!fs.existsSync(SRC)) { console.log('archive: 入力がないので飛ばします'); process.exit(0); }

const cfgPath = p('data/archive/config.json');
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : { public: false };
const NOINDEX = !cfg.public;

const posts = fs.readFileSync(SRC, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  .filter((r) => r.body && r.body.trim())
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

const shell = ({ title, body, desc = '' }) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
${NOINDEX ? '<meta name="robots" content="noindex,nofollow">\n' : ''}<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">\n` : ''}<meta property="og:title" content="${esc(title)}">
<link rel="stylesheet" href="/shared/base.css">
<style>
.arc-head{border-bottom:1px solid var(--rule);padding-bottom:1.5rem;margin-bottom:1.5rem}
.arc-head h1{margin:.2rem 0 .5rem}
.arc-lead{color:var(--text-2);font-size:.92rem;margin:0}
.timeline{display:flex;align-items:flex-end;gap:2px;height:3.2rem;margin:1.5rem 0 .4rem}
.timeline div{flex:1;background:var(--accent);opacity:.55;border-radius:1px 1px 0 0;min-height:2px}
.timeline div:hover{opacity:1}
.tl-lab{display:flex;justify-content:space-between;font-size:.68rem;color:var(--text-3);font-variant-numeric:tabular-nums;margin-bottom:1.6rem}
.filters{display:grid;gap:.5rem;margin-bottom:1.5rem}
@media(min-width:34rem){.filters{grid-template-columns:1fr auto auto}}
.filters input,.filters select{background:var(--surface);color:var(--text);border:1px solid var(--rule);border-radius:3px;padding:.5rem .7rem;font:inherit;font-size:.88rem}
.count{font-size:.76rem;color:var(--text-3);letter-spacing:.05em;margin-bottom:1rem;font-variant-numeric:tabular-nums}
.arc-list{list-style:none;margin:0;padding:0}
.arc-list li{border-bottom:1px solid var(--rule);padding:.85rem 0}
.arc-list a{color:var(--text);text-decoration:none;font-size:.98rem;line-height:1.6}
.arc-list a:hover{color:var(--accent)}
.arc-list .m{font-size:.72rem;color:var(--text-3);letter-spacing:.05em;margin-top:.2rem;font-variant-numeric:tabular-nums}
.arc-list .cat{color:var(--accent)}
.arc-list .cat.star{color:#D6B36A}
.nav{display:flex;justify-content:space-between;gap:1rem;margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--rule);font-size:.86rem}
.nav a{max-width:45%}
.note{font-size:.8rem;color:var(--text-3);margin-top:2rem}
</style>
</head>
<body>
<div class="page">
<header class="site-header"><a href="/">松村有晃</a></header>
<main>
${body}
</main>
<footer class="site-footer"><a href="/archive/">archive 目次</a> ／ <a href="/">トップ</a></footer>
</div>
<script src="/shared/qr-share.js" defer></script>
</body>
</html>`;

// ---------- 記事ページ ----------
for (let i = 0; i < posts.length; i++) {
  const r = posts[i], prev = posts[i - 1], next = posts[i + 1];
  const body =
    `<article class="doc">` +
    `<div class="meta"><span class="kind">旧ブログ</span><time datetime="${esc(r.date)}">${esc(r.date)}</time>` +
    (r.category ? `<span>${esc(r.category)}</span>` : '') + `</div>` +
    `<h1>${esc(r.title) || '（無題）'}</h1>` +
    `<div style="white-space:pre-wrap;color:var(--text-2)">${esc(r.body)}</div>` +
    `<nav class="nav">` +
    (prev ? `<a href="/archive/${prev.id}/">← ${esc(prev.title).slice(0, 24)}</a>` : '<span></span>') +
    (next ? `<a href="/archive/${next.id}/" style="text-align:right">${esc(next.title).slice(0, 24)} →</a>` : '<span></span>') +
    `</nav>` +
    `<p class="note">元記事: <a href="${esc(r.url)}" rel="noopener">${esc(r.url)}</a></p>` +
    `</article>`;
  write(`site/archive/${r.id}/index.html`, shell({
    title: `${r.title || '（無題）'} — 旧ブログ ${r.date}`,
    body,
    desc: r.body.replace(/\s+/g, ' ').slice(0, 100),
  }));
}

// ---------- 索引 ----------
const years = [...new Set(posts.map((r) => r.date.slice(0, 4)).filter(Boolean))].sort();
const counts = years.map((y) => posts.filter((r) => r.date.startsWith(y)).length);
const max = Math.max(...counts);
const cats = [...new Set(posts.map((r) => r.category).filter(Boolean))].sort();

write('site/archive/data.json', JSON.stringify(posts.map((r) => ({
  i: r.id, d: r.date, t: r.title, c: r.category, n: r.body.length, b: r.body,
}))));

const indexBody =
  `<div class="arc-head">
    <div class="meta"><span class="kind">archive</span><span>2005 — 2026</span></div>
    <h1>旧ブログ</h1>
    <p class="arc-lead">2005年から書き続けた ${posts.length.toLocaleString()} 本。合計 ${posts.reduce((s, r) => s + r.body.length, 0).toLocaleString()} 文字。当時のまま置いています。</p>
  </div>
  <div class="timeline">${years.map((y, i) => `<div style="height:${Math.max(2, (counts[i] / max) * 100)}%" title="${y}年 ${counts[i]}件"></div>`).join('')}</div>
  <div class="tl-lab"><span>${years[0]}</span><span>${years[years.length - 1]}</span></div>
  <div class="filters">
    <input id="q" placeholder="本文とタイトルを検索" autocomplete="off">
    <select id="y"><option value="">全ての年</option>${years.map((y) => `<option>${y}</option>`).join('')}</select>
    <select id="c"><option value="">全てのカテゴリ</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
  </div>
  <div class="count" id="count"></div>
  <ul class="arc-list" id="list"></ul>
  <script>
  fetch('/archive/data.json').then(r=>r.json()).then(D=>{
    const $=i=>document.getElementById(i);
    const esc=s=>(s||'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
    function render(){
      const q=$('q').value.trim(), y=$('y').value, c=$('c').value;
      const hit=D.filter(r=>(!y||r.d.startsWith(y))&&(!c||r.c===c)&&(!q||(r.t||'').includes(q)||r.b.includes(q)));
      $('count').textContent=hit.length.toLocaleString()+' / '+D.length.toLocaleString()+' 件';
      $('list').innerHTML=hit.slice(0,400).map(r=>
        '<li><a href="/archive/'+r.i+'/">'+(esc(r.t)||'（無題）')+'</a><div class="m">'+r.d+
        (r.c?' · <span class="cat'+(r.c==='★★★'?' star':'')+'">'+esc(r.c)+'</span>':'')+' · '+r.n+'字</div></li>').join('')
        +(hit.length>400?'<li class="m" style="padding:1rem 0">先頭400件を表示しています。絞り込んでください。</li>':'');
    }
    ['q','y','c'].forEach(i=>$(i).addEventListener('input',render));
    render();
  });
  </script>`;

write('site/archive/index.html', shell({
  title: '旧ブログ archive 2005–2026',
  body: indexBody,
  desc: `2005年から2026年までの${posts.length}記事。`,
}));

console.log(`archive: ${posts.length}記事 + 索引を書き出しました（${NOINDEX ? '検索避けあり' : '正式公開'}）`);
