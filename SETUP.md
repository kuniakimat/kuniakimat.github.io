# セットアップ手順（P-1 保全 → P0 骨格）

Mac のターミナルで進めます。コマンドは Claude Code に「これをやって」と渡せば実行してくれます。

---

## ステップ0: 道具を入れる（一度だけ・10分）

```bash
# Homebrew が未導入の場合
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# GitHub CLI と Node
brew install gh node

# GitHub にログイン（ブラウザが開くので承認する）
gh auth login
```

`gh auth login` の選択肢は次の通り答えます。

- What account do you want to log into? → **GitHub.com**
- What is your preferred protocol? → **HTTPS**
- Authenticate Git with your GitHub credentials? → **Yes**
- How would you like to authenticate? → **Login with a web browser**

これ以降、GitHub の画面を触る作業はほぼ不要になります。

---

## ステップ1: 避難所をつくり、13リポを全部落とす（10分・Claude Code に任せられる）

```bash
mkdir -p ~/mat-vault/repos && cd ~/mat-vault/repos

# 公開・非公開すべてのリポジトリを一括で clone
gh repo list kuniakimat --limit 100 --json name --jq '.[].name' \
  | xargs -I{} gh repo clone kuniakimat/{} {}
```

終わったら確認します。

```bash
ls -1 ~/mat-vault/repos
```

13個（うち2つは空リポ）が並んでいれば完了です。**この時点で、アプリ資産は GitHub と Mac の2箇所に存在する状態**になります。

---

## ステップ2: note をエクスポートする（5分・人がやる）

ブラウザから実行します（iOS / Android アプリでは実行できません）。

1. note にログインし、設定画面を開く
2. エクスポート機能を実行する
3. 生成された ZIP をダウンロードする

中身は WordPress 形式（WXR）の XML と、記事にアップロードした画像一式です。

```bash
mkdir -p ~/mat-vault/note-export
# ダウンロードした ZIP を上のフォルダに移して展開する
```

この XML が、そのまま逆輸入（P2）の原料になります。Markdown への変換は Claude Code が引き受けます。

---

## ステップ3: Evernote を書き出す（10分・人がやる）

Evernote から ENEX 形式で書き出し、`~/mat-vault/evernote/` に置きます。ノートブック単位で分けて出すと、後の発掘が楽になります。

ChatGPT のエディターエージェントに投入した側からは取り出せないため、Evernote 本体から出す必要があります。

---

## ステップ4: 旧ブログを保存する（Claude Code に任せられる）

exblog には公式のエクスポート機能がありません。自分のブログなので、公開ページを巡回して手元に保存します。

```bash
mkdir -p ~/mat-vault/exblog && cd ~/mat-vault/exblog

wget --mirror --convert-links --adjust-extension --page-requisites \
     --no-parent --wait=1 --random-wait \
     https://<あなたのexblogのURL>/
```

`--wait=1` を付けているのは、相手のサーバーに負荷をかけないためです。時間はかかりますが、放っておけば終わります。

プロジェクトにある Exblog Complete Index と突き合わせて、取りこぼしがないかを Claude Code に確認させます。

---

## ステップ5: 避難所をもう1箇所に複製する（重要）

```bash
# 外付けドライブや iCloud / Dropbox など、Mac 以外の場所へ
cp -R ~/mat-vault /Volumes/<外付け>/mat-vault-backup
```

**ここまでで保全は完了です。この先の整理作業でどれだけ大胆に動かしても、失うものはありません。**

---

## ステップ6: 作業リポジトリを立ち上げる（P0）

このスターターキットの中身を `~/mat/` に置きます。

```bash
mkdir -p ~/mat
# このキットの中身を ~/mat/ にコピーしてから
cd ~/mat

npm install
git init
git add -A
git commit -m "P0: 骨格"

# GitHub にユーザーサイト用リポジトリを作成して push
gh repo create kuniakimat.github.io --public --source=. --remote=origin --push

# GitHub Pages を有効にする
gh api -X POST repos/kuniakimat/kuniakimat.github.io/pages \
  -f "source[branch]=main" -f "source[path]=/" 2>/dev/null \
  || echo "Pages は Actions 経由で公開するので、この手順は省略可"
```

数分後、`https://kuniakimat.github.io/` が立ち上がります。

---

## ステップ7: アプリを集約する（P1）

```bash
cd ~/mat

# vault の clone から、中身だけを apps/ へコピー（vault 側は触らない）
for r in happiness sons chugo country onehour kinomi sons_fable sons_story character -happiness-map index; do
  mkdir -p apps/$r
  rsync -a --exclude '.git' ~/mat-vault/repos/$r/ apps/$r/
done

npm run build
git add -A && git commit -m "P1: 13リポの中身を apps/ へ集約"
```

集約後、旧リポにはリダイレクト用の1枚 HTML を置きます。これも Claude Code に頼めば13本まとめて作ってくれます。既存のリンクは生き続けます。

---

## 以降

- **P2 逆輸入** — note の WXR と旧ブログの HTML を Markdown に変換して `content/` へ
- **P3 台帳** — `data/registry.yml` は主要分を投入済み。残りを流し込む
- **P4 自動化** — `.github/workflows/publish.yml` は同梱済み。push すれば動きます
- **P5 運用開始** — `content/_inbox/` に素案を置いて `npm run ingest`

---

## 困ったときの戻し方

```bash
git log --oneline           # どこまで戻れるか確認
git diff HEAD~1             # 直前の変更内容を見る
git checkout HEAD~1 -- <パス>   # 特定のファイルだけ前の状態に戻す
git reset --hard HEAD~1     # 直前のコミットごと取り消す（コミット済みの変更が対象）
```

`_trash/` に移したものは、そのまま残っています。
