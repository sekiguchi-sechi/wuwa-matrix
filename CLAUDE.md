# wuwa-matrix — 鳴潮「終焉マトリクス編成板」

2つの Claude Artifact（サーバー費用なし）
- 管理用: https://claude.ai/code/artifact/8568be50-670a-4d19-bd60-6980a86bda35 （db/assets/downloads。マスタ編集・Claude連携・定期タスクの書込先）
- 提供用: https://claude.ai/code/artifact/ede260f8-4dcd-4cae-85f2-383bab5c270b （静的。マスタはHTMLに埋め込み。編成はブラウザのlocalStorage）

## ファイル
- `template.html` … 両アプリ共通のソース（`__DEFAULT_DATA__` / `__MODE__` / `__TITLE__` を build.py が置換）
- `build.py [data.json]` … `web/index.html`（管理用 MODE=admin）と `public/index.html`（提供用 MODE=public）を生成し、`web/img` を `public/img` へコピー
- `build_data.py` … 初期データ生成（参考サイト ref-data.json + 手入力の期間情報 → data.json）。通常は使わない
- `web/img/` … キャラ/ボス画像（webp）。提供用にも同じものを同梱

## 提供用アプリを最新マスタで更新する手順（「提供用の編成板を最新のマスタで更新して」）
1. 管理用の db を読む: Artifact `read_db` get `master/characters` と `master/periods`（url=管理用）
2. `data.json` を組み立てる: `{characters: chars.list, periods: periods.list, updatedAt, source, defaultPeriod: 今日が含まれる期間のid}`
3. icon が `/_blob/<id>` のキャラは `read_asset`（url=管理用, asset_id=<id>）でローカル保存 → `web/img/c_<id>.webp` に置き、data.json の icon を `img/c_<id>.webp` に書き換える
4. `python build.py data.json` → `public/index.html`
5. Artifact publish: file_path=`public/index.html`, url=提供用URL, root=`public`, files に `img/*.webp` を全部（新規画像を含む）。capabilities は渡さない（提供用は宣言なしのまま）
6. 管理用も同じテンプレなら `web/index.html` を url=管理用 で republish（capabilities は省略で引き継ぎ）

## 管理用 db の構造
- `master/characters` {list:[{id,name,attr,rank,ver,icon,aliases?,upcoming?}],updatedAt,source}
- `master/periods` {list:[{id,label,ver,dates,start,end,verified,crisis[],twice[],circuits[{name,text}],enemies[{name,attr,icon,desc}],note?}],updatedAt}（先頭が最新期）
- `app/state` {v:2,period,owned[],plans:{[periodId]:{teams:[{id,name,memo,enemy,members[]}]}}} … ユーザーの編成。触らない

## 定期タスク
`wuwa-matrix-data-update`（デスクトップアプリのルーティン、木・日 21:00）が Wiki/Game8 を調べて管理用 db を更新。提供用は自動では更新しない（ユーザーが依頼したときに上の手順で再公開）。
