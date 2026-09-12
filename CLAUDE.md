# wuwa-matrix — 鳴潮「終焉マトリクス編成板」

公開ページ（提供用・静的・サーバー費用なし）: https://sekiguchi-sechi.github.io/wuwa-matrix/
リポジトリ `sekiguchi-sechi/wuwa-matrix` の main ブランチ `docs/` を GitHub Pages で公開。**マスタデータの正本は `data.json`**（git履歴で変更を追う）。
GitHub 操作は gh CLI（`C:\Program Files\GitHub CLI\gh.exe`、sekiguchi-sechi でログイン済み）。リポジトリ内の git config に user.name/email 設定済み。

## ファイル
- `data.json` … マスタ（正本）。`{characters:[...], periods:[...], updatedAt, source, defaultPeriod}`
  - characters: `{id("061"等3桁), name, attr(回折/気動/凝縮/消滅/焦熱/電導), rank(4|5), ver("3.7"), icon("img/c_xxx.webp" or ""), aliases?[別表記], upcoming?(true=未実装)}`
  - periods（先頭が最新期）: `{id("s2-3"), label("S2-3"), ver("ver3.7"), dates(表示用), start("YYYY-MM-DD"), end("YYYY-MM-DD"|""), verified(true|false), crisis[担当名], twice[2回出撃可=ヒーラー枠+担当], circuits[{name,text}], enemies[{name, attr, icon, desc}], note?}`
  - enemies[].desc は「1ラウンド目で有効化\n<危機対応·…>\n本文\n\n2ラウンド目で有効化\n<危機進化·…>\n本文」の形式
  - ページは start/end から「今日の開催期間」を判定して切替バナーを出す。verified:false は「要確認」表示
- `template.html` … ページのソース（`__DEFAULT_DATA__` / `__MODE__` / `__TITLE__` を build.py が置換）
- `build.py [data.json] [--admin]` … `docs/index.html` を生成し `web/img` → `docs/img` コピー。`--admin` で管理用Artifact向け `web/index.html` も生成（通常不要）
- `web/img/` … キャラ/ボス画像（webp, 192px）。キャラは `c_character_NNN.webp`、新規は `c_<id>.webp`

## マスタ更新の手順（定期タスク／「編成板を最新にして」）
1. `git -C C:\Users\mirai\wuwa-matrix pull --ff-only`
2. `data.json` を読み、Web（鳴潮Wiki* 共鳴者一覧・終焉マトリクス、Game8）で差分を調べる
3. 差分があれば `data.json` を編集（id・icon・並び順は保持。新キャラは id=既存最大+1、新期は先頭に追加し verified:false）
4. 新キャラのアイコンが取れたら Python(PIL) で 192px 正方形 webp にして `web/img/c_<id>.webp` に保存し icon に `img/c_<id>.webp`
5. `python build.py` → `git add -A && git commit -m "data: ..." && git push` → 1〜2分で公開ページに反映（`gh api repos/sekiguchi-sechi/wuwa-matrix/pages --jq .status` が built）
6. 差分がなければコミットしない

## 補足
- 旧・管理用 Artifact（db連携版）は 2026-09-12 に GitHub 一本化へ移行したため役目終了
- ref-data.json と build_data.py は参考サイト由来なので公開リポジトリに含めない（gitignore 済み）
- 編成・所持はユーザーのブラウザ localStorage にのみ保存される（サーバー側には何も持たない）
