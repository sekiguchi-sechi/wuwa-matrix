#!/usr/bin/env python3
"""終焉マトリクス編成板のビルド。

使い方:
  python build.py            data.json を検証し docs/ を生成する
  python build.py --check    data.json の検証だけ行う（ビルドしない）

生成物 docs/（GitHub Pages の公開元）:
  index.html  … src/index.html をそのままコピー
  style.css   … src/style.css
  app.js      … src/js/*.js をファイル名順に連結（1つの即時関数に包む）
  data.js     … data.json を window.__DATA__ に注入（file:// でも fetch 不要で動く）
  vendor/     … src/vendor/（SortableJS, html2canvas）
  img/        … assets/img/
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC, ASSETS, DOCS = ROOT / "src", ROOT / "assets", ROOT / "docs"
ATTRS = {"回折", "気動", "凝縮", "消滅", "焦熱", "電導", "物理"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate(d):
    """data.json の整合性チェック。問題があれば文字列のリストを返す。"""
    errs = []
    chars = d.get("characters")
    periods = d.get("periods")
    if not isinstance(chars, list) or not chars:
        errs.append("characters が空です")
        chars = []
    if not isinstance(periods, list) or not periods:
        errs.append("periods が空です")
        periods = []

    ids, names = set(), set()
    for c in chars:
        cid = str(c.get("id", ""))
        if not cid or not c.get("name"):
            errs.append(f"characters: id/name が空 ({c})")
            continue
        if cid in ids:
            errs.append(f"characters: id が重複 {cid}")
        if c["name"] in names:
            errs.append(f"characters: name が重複 {c['name']}")
        ids.add(cid)
        names.add(c["name"])
        if c.get("attr") not in ATTRS:
            errs.append(f"characters[{cid}] {c['name']}: attr が不正 {c.get('attr')!r}")
        if c.get("rank") not in (4, 5):
            errs.append(f"characters[{cid}] {c['name']}: rank は 4 か 5 ({c.get('rank')!r})")
        icon = c.get("icon") or ""
        if icon and not (ASSETS / icon).is_file():
            errs.append(f"characters[{cid}] {c['name']}: icon が存在しない {icon}")

    pids = set()
    for p in periods:
        pid = str(p.get("id", ""))
        if not pid or not p.get("label"):
            errs.append(f"periods: id/label が空 ({p})")
            continue
        if pid in pids:
            errs.append(f"periods: id が重複 {pid}")
        pids.add(pid)
        for key in ("start", "end"):
            v = p.get(key) or ""
            if v and not DATE_RE.match(v):
                errs.append(f"periods[{pid}]: {key} は YYYY-MM-DD 形式 ({v!r})")
        if not p.get("start"):
            errs.append(f"periods[{pid}]: start が空（開催期間の自動判定に必要）")
        for e in p.get("enemies") or []:
            if not e.get("name"):
                errs.append(f"periods[{pid}]: 敵の name が空")
            if e.get("attr") not in ATTRS:
                errs.append(f"periods[{pid}] {e.get('name')}: attr が不正 {e.get('attr')!r}")
            icon = e.get("icon") or ""
            if icon and not (ASSETS / icon).is_file():
                errs.append(f"periods[{pid}] {e.get('name')}: icon が存在しない {icon}")
        for n in (p.get("crisis") or []) + (p.get("twice") or []):
            if not any(match_name(c, n) for c in chars):
                errs.append(f"periods[{pid}]: crisis/twice の名前がキャラ一覧に無い {n!r}")
    dp = d.get("defaultPeriod")
    if dp and dp not in pids:
        errs.append(f"defaultPeriod が periods に無い {dp!r}")
    return errs


def _norm(s):
    return re.sub(r"[・()（）\s]", "", str(s or ""))


def match_name(c, n):
    return c.get("id") == n or c.get("name") == n or _norm(c.get("name")) == _norm(n) \
        or any(_norm(a) == _norm(n) for a in c.get("aliases") or [])


def build(d):
    if DOCS.exists():
        for child in DOCS.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    DOCS.mkdir(exist_ok=True)
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")
    shutil.copy2(SRC / "index.html", DOCS / "index.html")
    shutil.copy2(SRC / "style.css", DOCS / "style.css")
    js_parts = [f"/* ==== {p.name} ==== */\n{p.read_text(encoding='utf-8')}" for p in sorted((SRC / "js").glob("*.js"))]
    app_js = "/* 生成物: src/js/*.js を build.py が連結したもの。編集は src/ 側で行う */\n(function () {\n\"use strict\";\n" + "\n".join(js_parts) + "\n})();\n"
    (DOCS / "app.js").write_text(app_js, encoding="utf-8")
    data_js = "/* 生成物: data.json を build.py が注入したもの */\nwindow.__DATA__ = " + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (DOCS / "data.js").write_text(data_js, encoding="utf-8")
    shutil.copytree(SRC / "vendor", DOCS / "vendor")
    shutil.copytree(ASSETS / "img", DOCS / "img")


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    data_path = ROOT / "data.json"
    try:
        d = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as e:  # JSON 崩れは最も起きやすい事故なので分かりやすく
        print(f"data.json を読めません: {e}", file=sys.stderr)
        return 1
    errs = validate(d)
    if errs:
        print("data.json 検証エラー:", file=sys.stderr)
        for e in errs:
            print("  - " + e, file=sys.stderr)
        return 1
    if "--check" in argv:
        print(f"ok: キャラ {len(d['characters'])}人 / 期間 {len(d['periods'])}件")
        return 0
    for required in (SRC / "index.html", SRC / "style.css", SRC / "js", SRC / "vendor", ASSETS / "img"):
        if not required.exists():
            print(f"必要なファイルがありません: {required}", file=sys.stderr)
            return 1
    build(d)
    print(f"built docs/ (キャラ {len(d['characters'])}人 / 期間 {len(d['periods'])}件)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
