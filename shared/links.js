// links.js — 全アプリ・全ページ共通のナビを、台帳から配る
// 各アプリの HTML に <div id="mat-nav"></div> を置くだけで、リンクが自動で揃う
(async () => {
  const el = document.getElementById('mat-nav');
  if (!el) return;
  try {
    const r = await fetch('/shared/links.json');
    const { nav } = await r.json();
    const here = location.pathname;
    el.innerHTML =
      '<ul class="index-list">' +
      nav
        .filter((n) => !here.startsWith(n.url))
        .map((n) => `<li><a href="${n.url}">${n.title}</a></li>`)
        .join('') +
      '</ul>';
  } catch (e) {
    /* リンクが読めなくてもページ本体は壊さない */
  }
})();
