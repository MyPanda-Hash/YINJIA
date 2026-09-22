/* _tc-grid.cjs — 从 YJ-QR-60 扫描图里量出表格线位置(纯 Node:自带 zlib 解 PNG,不依赖任何库)
   用途:QC_TC_IN 版式要「1:1 对齐原图、留空位置一致」,列宽比例与行高必须来自实测,
        而不是肉眼估。输出:横线 y / 竖线 x 及其覆盖率,再用比例换算到 940px 纸面。
   用法:node tools/archive/_tc-grid.cjs tools/archive/_tc-form.png */
const fs = require('node:fs'), zlib = require('node:zlib')

const file = process.argv[2] || 'tools/archive/_tc-form.png'
const buf = fs.readFileSync(file)
let pos = 8, W = 0, H = 0, bd = 0, ct = 0
const idat = []
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos)
  const type = buf.toString('ascii', pos + 4, pos + 8)
  const data = buf.subarray(pos + 8, pos + 8 + len)
  if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); bd = data[8]; ct = data[9] }
  if (type === 'IDAT') idat.push(data)
  pos += 12 + len
}
const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]
if (!bpp || bd !== 8) { console.error(`不支持的 PNG:bitDepth=${bd} colorType=${ct}`); process.exit(1) }
console.log(`图 ${W}×${H}  bitDepth=${bd} colorType=${ct}`)

// 解压 + 逐行反滤波(PNG 五种 filter)
const raw = zlib.inflateSync(Buffer.concat(idat))
const stride = W * bpp
const img = Buffer.alloc(H * stride)
for (let y = 0; y < H; y++) {
  const f = raw[y * (stride + 1)]
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1) + 1)
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? img[y * stride + x - bpp] : 0
    const b = y > 0 ? img[(y - 1) * stride + x] : 0
    const c = (x >= bpp && y > 0) ? img[(y - 1) * stride + x - bpp] : 0
    let v = line[x]
    if (f === 1) v += a
    else if (f === 2) v += b
    else if (f === 3) v += (a + b) >> 1
    else if (f === 4) {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
    } else if (f !== 0) { console.error('未知 filter ' + f); process.exit(1) }
    img[y * stride + x] = v & 0xff
  }
}
const gray = (x, y) => { const i = y * stride + x * bpp; return (img[i] + img[i + 1] + img[i + 2]) / 3 }
const DARK = 170

// 横线:某一行里暗像素占比 ≥60%;同时报出该线从哪到哪(判断它是否横穿最左列)
console.log('\n=== 横线(表格行边界)===')
const rows = []
for (let y = 0; y < H; y++) {
  let n = 0, first = -1, last = -1
  for (let x = 0; x < W; x++) if (gray(x, y) < DARK) { n++; if (first < 0) first = x; last = x }
  if (n / W >= 0.6) rows.push({ y, cover: +(n / W * 100).toFixed(1), first, last })
}
// 相邻的合并成一条(取中位)
for (const g of group(rows)) {
  const it = g.items[Math.floor(g.items.length / 2)]
  console.log(`  y=${g.c}  覆盖 ${g.max}%  (${g.n}px 厚)  x ${it.first}..${it.last}`)
}

// 竖线:只看表格主体那段,并报出每条竖线的**连续段落**(表格是手工做的,竖线常常只贯穿部分行)
const Y0 = 110, Y1 = 644, SPAN = Y1 - Y0
console.log(`\n=== 竖线(表格列边界)及其贯穿段落(y ${Y0}..${Y1})===`)
const cols = []
for (let x = 0; x < W; x++) {
  const segs = []
  let start = -1
  for (let y = Y0; y <= Y1; y++) {
    const dark = gray(x, y) < DARK
    if (dark && start < 0) start = y
    if (!dark && start >= 0) { if (y - start >= 8) segs.push([start, y - 1]); start = -1 }
  }
  if (start >= 0 && Y1 - start >= 8) segs.push([start, Y1])
  const total = segs.reduce((s, [a, b]) => s + (b - a + 1), 0)
  if (total / SPAN >= 0.03) cols.push({ y: x, cover: +(total / SPAN * 100).toFixed(1), segs })
}
for (const g of group(cols)) {
  const it = g.items.reduce((a, b) => (b.segs.length >= a.segs.length ? b : a))
  console.log(`  x=${g.c}  (${g.n}px 厚, 共 ${it.cover}%)`)
  for (const [a, b] of it.segs) console.log(`        y ${a}..${b}   (高 ${b - a + 1})`)
}

// 逐行带扫描:给出每一行**自己**的列边界(手工表里同一列在不同行常常错开,这正是「错位」的来源)
if (process.argv[3] === 'rows') {
  const ys = []
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let x = 0; x < W; x++) if (gray(x, y) < DARK) n++
    if (n / W >= 0.6) ys.push(y)
  }
  const bands = group(ys.map(y => ({ y, cover: 100 }))).map(g => g.c)
  console.log('\n=== 每一行自己的列边界(行高与横线位置来自实测)===')
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i] + 3, b = bands[i + 1] - 3   // 去掉横线本身的厚度
    if (b - a < 6) continue
    const xs = []
    for (let x = 0; x < W; x++) {
      let d = 0
      for (let y = a; y <= b; y++) if (gray(x, y) < DARK) d++
      if (d / (b - a + 1) >= 0.8) xs.push(x)
    }
    const found = group(xs.map(x => ({ y: x, cover: 100 }))).map(g => g.c)
    console.log(`  行 y ${bands[i]}..${bands[i + 1]} (高 ${bands[i + 1] - bands[i]})  竖线 x: ${found.join(' | ') || '(无)'}`)
  }
}

// 逐行「墨迹」位置:每行里实际有内容(字/勾选框)的 x 区段 —— 「留空位置与 Excel 一致」的判据
if (process.argv[3] === 'ink') {
  const ys = []
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let x = 0; x < W; x++) if (gray(x, y) < DARK) n++
    if (n / W >= 0.6) ys.push(y)
  }
  const bands = group(ys.map(y => ({ y, cover: 100 }))).map(g => g.c)
  console.log('\n=== 每一行的墨迹 x 区段(空档即「留空位置」)===')
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i] + 3, b = bands[i + 1] - 3
    if (b - a < 6) continue
    const hit = []
    for (let x = 32; x < W - 32; x++) {
      let d = 0
      for (let y = a; y <= b; y++) if (gray(x, y) < DARK) d++
      if (d > 0) hit.push(x)
    }
    const segs = []
    for (const x of hit) {
      const last = segs[segs.length - 1]
      if (last && x - last[1] <= 6) last[1] = x
      else segs.push([x, x])
    }
    console.log(`  行 y ${bands[i]}..${bands[i + 1]}(高 ${bands[i + 1] - bands[i]}): ` +
      (segs.map(([s, e]) => (e - s >= 2 ? `${s}-${e}` : `${s}`)).join(' ') || '(全空)'))
  }
}

function group(list) {
  const out = []
  for (const it of list) {
    const last = out[out.length - 1]
    if (last && it.y - last.last <= 2) { last.last = it.y; last.items.push(it) }
    else out.push({ first: it.y, last: it.y, items: [it] })
  }
  return out.map(g => ({
    c: Math.round((g.first + g.last) / 2), n: g.last - g.first + 1,
    max: Math.max(...g.items.map(i => i.cover)), items: g.items,
  }))
}
