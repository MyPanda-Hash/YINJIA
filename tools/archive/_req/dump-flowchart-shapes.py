import zipfile, re, os, html

PATH = r'C:\INCER\YINJIA-MES\_scratch\req.xlsx'
OUT = r'C:\INCER\YINJIA-MES\_scratch\req-shapes.txt'

with zipfile.ZipFile(PATH) as z:
    xml = z.read('xl/drawings/drawing1.xml').decode('utf-8', 'ignore')

# 每个形状/连接点：抓 xdr:from 的 col/row + 该 shape 内的 a:t 文本
lines = []
# 以 <xdr:sp> 或 <xdr:twoCellAnchor> 为切片单位，逐块取位置与文本
blocks = re.split(r'(?=<xdr:twoCellAnchor|<xdr:oneCellAnchor)', xml)
for b in blocks:
    pos = re.search(r'<xdr:from>\s*<xdr:col>(\d+)</xdr:col>\s*<xdr:colOff>(\d+)</xdr:colOff>\s*<xdr:row>(\d+)</xdr:row>', b)
    to = re.search(r'<xdr:to>\s*<xdr:col>(\d+)</xdr:col>\s*<xdr:colOff>(\d+)</xdr:colOff>\s*<xdr:row>(\d+)</xdr:row>', b)
    texts = [html.unescape(t).strip() for t in re.findall(r'<a:t>(.*?)</a:t>', b, re.S)]
    texts = [t for t in texts if t]
    if not texts:
        continue
    p = f'col{pos.group(1)} row{pos.group(3)}' if pos else '?'
    q = f'-> col{to.group(1)} row{to.group(3)}' if to else ''
    lines.append((int(pos.group(3)) if pos else 9999, int(pos.group(1)) if pos else 9999, f'[{p} {q}] ' + ' | '.join(texts)))

lines.sort()
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(f'共 {len(lines)} 个带文字的形状（按 row,col 排序）\n\n')
    for _, _, t in lines:
        f.write(t + '\n')

print('shapes with text:', len(lines), '->', OUT)
print('bytes:', os.path.getsize(OUT))
