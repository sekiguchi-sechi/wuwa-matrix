# wuwa-matrix — 鳴潮「終焉マトリクス編成板」

公開ページ（静的・サーバー費用なし）: https://sekiguchi-sechi.github.io/wuwa-matrix/
リポジトリ `sekiguchi-sechi/wuwa-matrix` の main ブランチ `docs/` を GitHub Pages で公開。**マスタデータの正本は `data.json`**（変更は git 履歴で追う）。
GitHub 操作は gh CLI（`C:\Program Files\GitHub CLI\gh.exe`、sekiguchi-sechi でログイン済み）。リポジトリ内の git config に user.name/email 設定済み。

## ファイル
- `data.json` … マスタ（正本）。`{characters:[...], periods:[...], updatedAt, source, defaultPeriod}`
  - characters: `{id("061"等3桁), name, attr(回折/気動/凝縮/消滅/焦熱/電導), rank(4|5), ver("3.7"), icon("img/c_xxx.webp" or ""), aliases?[別表記], upcoming?(true=未実装)}`
  - periods: `{id("s2-3"), label("S2-3"), ver("ver3.7"), dates(表示用), start("YYYY-MM-DD" 必須), end("YYYY-MM-DD"|""), verified(true|false), crisis[担当名], twice[2回出撃可=ヒーラー枠+担当], circuits[{name,text}], enemies[{name, attr, icon, desc}], note?}`
  - enemies[].desc は「1ラウンド目で有効化\n<危機対応·…>\n本文\n\n2ラウンド目で有効化\n<危機進化·…>\n本文」の形式
  - ページは start/end から「今日の開催期間」を判定して初期表示・切替バナーに使う。periods の並びは start 降順にページ側で整える。verified:false は「要確認」表示
- `src/index.html`, `src/style.css`, `src/js/NN-*.js`（番号順に連結）, `src/vendor/`（SortableJS・html2canvas 同梱）
- `assets/img/` … キャラ/ボス画像（webp, 192px）。キャラは `c_character_NNN.webp`（初期分）または `c_<id>.webp`（追加分）
- `build.py` … `data.json` を検証して `docs/` を生成（index.html/style.css/app.js/data.js/vendor/img/.nojekyll）。`--check` で検証のみ。検証は id 重複・attr/rank・icon の実在・start の形式・crisis/twice の名前がキャラ一覧にあるか等。エラー時は非ゼロ終了で docs/ を触らない
- `docs/` … 生成物。手で編集しない
- `private/`（gitignore）… 参考サイト由来の ref-data.json と初期データ生成スクリプト。公開しない
- `.github/workflows/check.yml` … push 時に `build.py --check` と `docs/` の同期を検証

## マスタ更新の手順（定期タスク／「編成板を最新にして」）
1. `git -C C:\Users\mirai\wuwa-matrix pull --ff-only`
2. `data.json` を読み、Web（鳴潮Wiki* 共鳴者一覧・終焉マトリクス、Game8）で差分を調べる
3. 差分があれば `data.json` を編集（id・icon・並び順は保持。新キャラは id=既存最大+1、新期は先頭に追加し verified:false、start 必須）
4. 新キャラのアイコンが取れたら Python(PIL) で 192px 正方形 webp にして `assets/img/c_<id>.webp` に保存し icon に `img/c_<id>.webp`
5. `python build.py`（検証エラーが出たら直してから）→ `git add -A && git commit -m "data: ..." && git push` → 1〜2分で公開ページに反映（`gh api repos/sekiguchi-sechi/wuwa-matrix/pages --jq .status` が built）
6. 差分がなければコミットしない

## 変更履歴メモ
- 2026-09-12: Claude Artifact（管理用・提供用）を廃止して GitHub Pages に一本化。同日リファクタリング（src/ 分割・管理用コード削除・検証つき build・ライブラリ同梱・CI 追加）
- 編成・所持はユーザーのブラウザ localStorage にのみ保存（サーバー側には何も持たない）
