import json, os, shutil, sys
# 使い方: python build.py [data.json] [--admin]
#   docs/index.html（提供用, MODE=public）を生成し web/img を docs/img へコピーする。
#   --admin を付けると web/index.html（管理用Artifact向け, MODE=admin）も生成する。
args = [a for a in sys.argv[1:] if not a.startswith('--')]
data_path = args[0] if args else 'data.json'
d = json.load(open(data_path, encoding='utf-8'))
d.setdefault('defaultPeriod', d['periods'][0]['id'] if d.get('periods') else '')
t = open('template.html', encoding='utf-8').read()
def render(mode, title):
    return t.replace('__DEFAULT_DATA__', json.dumps(d, ensure_ascii=False)).replace('__MODE__', mode).replace('__TITLE__', title)
os.makedirs('docs', exist_ok=True)
open('docs/index.html', 'w', encoding='utf-8').write(render('public', '終焉マトリクス編成板'))
if os.path.isdir('docs/img'): shutil.rmtree('docs/img')
shutil.copytree('web/img', 'docs/img')
if '--admin' in sys.argv:
    os.makedirs('web', exist_ok=True)
    open('web/index.html', 'w', encoding='utf-8').write(render('admin', '終焉マトリクス編成板（管理）'))
print('built docs/index.html', 'and web/index.html' if '--admin' in sys.argv else '')
