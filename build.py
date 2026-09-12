import json, os, shutil, sys
data_path = sys.argv[1] if len(sys.argv) > 1 else 'data.json'
d = json.load(open(data_path, encoding='utf-8'))
d.setdefault('defaultPeriod', 's2-2')
t = open('template.html', encoding='utf-8').read()
def render(mode, title):
    return t.replace('__DEFAULT_DATA__', json.dumps(d, ensure_ascii=False)).replace('__MODE__', mode).replace('__TITLE__', title)
os.makedirs('web', exist_ok=True); os.makedirs('docs', exist_ok=True)
open('web/index.html', 'w', encoding='utf-8').write(render('admin', '終焉マトリクス編成板（管理）'))
open('docs/index.html', 'w', encoding='utf-8').write(render('public', '終焉マトリクス編成板'))
if os.path.isdir('docs/img'): shutil.rmtree('docs/img')
shutil.copytree('web/img', 'docs/img')
print('built admin+public', len(t))
