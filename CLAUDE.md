# CLAUDE.md — 4_作品 の恒久ルール

このフォルダは **公開サイトそのもの**（git リポジトリ → kuniakimat.github.io）。
Claude Code は毎回このファイルを読む。

上位の方針は `~/Matsumura/00_フォルダ方針.md` に従う。ここはその方針の中の「4_作品」を実装したもの。

## 家の中での位置

```
~/Matsumura/
├── 1_MatEditor/   編集OS（rules / archive / skills）。文体と発掘の道具
├── 2_資料/         読む専用。evernote / blog / note / データ。書き換えない
├── 3_原稿/         進行中・保留。ここで書く
├── 4_作品/  ★     このフォルダ。公開が決まったものだけが入る
├── 5_仕事/ 8_私用/ 9_保管/
└── ~/mat-vault/   原資料の避難所（別の場所）。読むだけ。書き込まない
```

**原稿の流れ**: `3_原稿/進行中/` で書く → 公開が決まったら `4_作品/content/` へ移す。
公開した原稿の原本は `4_作品/content/` にある（`3_原稿/公開済み/` は使わない）。

## 安全のための取り決め（最優先）

1. **ファイルを削除しない。** 不要になったものは `~/Matsumura/9_保管/` へ移す。`rm` は使わない。
2. **整理作業はブランチを切ってから。** `main` は結果を確認してから更新する。
3. **1フェーズごとにコミットする。** いつでも1コマンドで戻せる状態を保つ。
4. **大きな移動の前に、変更内容の一覧を先に出す。**
5. `~/mat-vault/`、`2_資料/`、`8_私用/` には書き込まない。
6. push する前に確認を取る。
7. `8_私用/` の中身は参照しない。

## このフォルダの構成

```
4_作品/
├── content/     公開する原稿の原本（Markdown）
│   ├── articles/ frameworks/ stories/ reports/
│   └── _inbox/   どのAIの素案もまずここへ。ingest で昇格
├── apps/        診断アプリ・物語アプリ・世界哲学ウェブの作品
├── data/        ★ 台帳。リンクの正解はすべてここにある
│   ├── registry.yml  全コンテンツの ID・題・URL・状態・関連
│   ├── links.yml     外部公開面（note / 旧ブログ / 対談）
│   └── canon.yml     概念 ID ↔ 正典の対応表
├── shared/      共通 CSS・JS
├── scripts/     build / linkcheck / ingest / note_export
├── site/        生成物。公開されるのはここ。手で編集しない
│   └── p/       仮公開領域（noindex）
└── SETUP.md     立ち上げ手順
```

## リンクの扱い

**本文に URL を書かない。** リンクは ID で書き、URL は `data/` が持つ。

- 記事から記事・アプリへ → front matter の `related: [id, ...]`
- 概念への言及 → `concepts: [広福観, ...]`（初出に自動でリンクが張られる）
- 外部（note・旧ブログ・対談）→ `data/links.yml` の ID

URL が変わったときに直す場所は、台帳の1行だけにする。

## 記事の front matter

```yaml
---
id: art-kofukukan-intro          # art- / app- / fw- / story- / rep-
title: 記事タイトル
date: 2026-08-28
concepts: [広福観, 幸福25相]
related: [app-happiness, art-jikanso-48]
external: note-ndd5e08cfedab      # 対応する外部公開面（あれば）
status: draft                     # draft / preview / public / paid
distribute:
  note: full                      # full / lead / paid / skip
  x: card                         # card / skip
  facebook: skip
source: chatgpt                   # chatgpt / claude / cowork / 手書き
---
```

### status の意味

- `draft` — 手元のみ。ビルド対象外
- `preview` — 仮公開。`site/p/<スラッグ>/` に noindex 付きで出る。索引・サイトマップには載らない
- `public` — 正式公開
- `paid` — 原本は手元に置き、サイト出力からは外す。本文は note の有料記事へ

`preview` から `public` への昇格は status を1語書き換えるだけ。仮公開中の修正はすべて引き継がれる。

## 版の扱い（方針書に合わせる）

作業中は1つのファイルを直し続ける。`(1)` `fixed3` `v8` を作らない。
公開に足る版ができたら、日付を付けて `~/Matsumura/9_保管/` へ複製する。
git の履歴があるので、複製は節目だけでよい。

## 旧ブログ archive の扱い

`data/archive/exblog.jsonl` が原本（1,292記事・724,131文字）。`npm run build` で
`site/archive/` に索引と記事ページを書き出す。

公開の切り替えは `data/archive/config.json` の1行。

    {"public": false}   検索避けを付ける。URLを知る人だけが読める（既定）
    {"public": true}    正式公開。検索にも載る

記事のURLは `/archive/<記事ID>/` で、旧ブログの記事IDをそのまま使っている。
これは変えない。外から貼られた exblog のリンクと番号で対応が取れる状態を保つため。

移行用の MT 形式ファイルは `~/Matsumura/9_保管/旧ブログ_移行用MT_20260831/` に保険として置いてある。

## 文体ルール

- 「XXXではなく、YYY」のような否定→肯定構文を避け、最初から肯定形で書く
- 詳細は `~/Matsumura/1_MatEditor/rules/` の Editor Rules・Voice OS に従う
- 過去素材の発掘は `~/Matsumura/1_MatEditor/archive/archive_search.py`（FIND / ECHO / TRACE / OPPOSE / CROSS / UNMINED）

## UI・デザインの決まり

- 濃い背景上のテキストは WCAG AA（4.5:1 以上）を確保する
- `body` の背景指定だけに頼らず、`body` 直下に `<div class="page">` を置き、`.page{background:var(--bg);min-height:100vh;}` で背景を持たせる
- `<meta name="color-scheme">` と CSS の `color-scheme` を併記する
- 作品ごとにフォルダを切り、中を `index.html` にする

## よく使うコマンド

```bash
npm run ingest      # content/_inbox/ の素案を取り込んで articles/ へ昇格
npm run build       # content + apps + data → site/
npm run linkcheck   # リンク切れ・未登録IDの検出
npm run note        # チャネル別の貼り付け用テキストを out/ に生成
npm run dev         # ビルドしてローカルで確認
```

## 作業を頼まれたときの進め方

1. 影響範囲を確認し、変更内容の一覧を先に出す
2. ブランチを切る
3. 変更する
4. `npm run linkcheck` を通す
5. コミットする
6. push の可否を確認する
