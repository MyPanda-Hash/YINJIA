import openpyxl, os, zipfile, re, io

PATH = r'C:\INCER\YINJIA-MES\_scratch\req.xlsx'
OUTDIR = r'C:\INCER\YINJIA-MES\_scratch\req-img'
os.makedirs(OUTDIR, exist_ok=True)

wb = openpyxl.load_workbook(PATH)
print('--- 每 sheet 的图片对象 ---')
for ws in wb.worksheets:
    imgs = getattr(ws, '_images', [])
    print(f'{ws.title}: {len(imgs)} 张')
    for i, img in enumerate(imgs):
        try:
            data = img._data()
            ext = 'png' if data[:4] == b'\x89PNG' else ('jpg' if data[:2] == b'\xff\xd8' else 'bin')
            fn = os.path.join(OUTDIR, f'{ws.title}-{i}.{ext}')
            with open(fn, 'wb') as f:
                f.write(data)
            print(f'   [{i}] {img.width}x{img.height} -> {os.path.basename(fn)} ({len(data)} bytes)')
        except Exception as e:
            print(f'   [{i}] 提取失败: {e}')

print('\n--- zip 内部结构(只看 media/drawings) ---')
with zipfile.ZipFile(PATH) as z:
    for n in z.namelist():
        if 'media' in n or 'drawing' in n or n.endswith('.rels'):
            print('  ', n, z.getinfo(n).file_size)

print('\n--- 各 drawing 里的文本节点(DrawingML a:t) ---')
with zipfile.ZipFile(PATH) as z:
    for n in sorted(z.namelist()):
        if re.match(r'xl/drawings/drawing\d+\.xml$', n):
            xml = z.read(n).decode('utf-8', 'ignore')
            texts = re.findall(r'<a:t>(.*?)</a:t>', xml, re.S)
            print(f'\n== {n} ({len(texts)} 段文本) ==')
            for t in texts:
                t = t.strip()
                if t:
                    print('   ', t)
