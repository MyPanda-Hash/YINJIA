/**
 * _extract-spec-images.cjs — 提取 2.1规格书 全部图片:
 * ① 规格书细分.xlsx 内嵌设计图(4 页各一张)
 * ② 9 份规格书示例 docx 内嵌图片
 * 输出到 tools/_spec-images/<来源>/ 并打印尺寸清单
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const OUT = path.join(__dirname, '_spec-images')
fs.rmSync(OUT, { recursive: true, force: true })
const dirs = ['fenxi', 'docx']
for (const d of dirs) fs.mkdirSync(path.join(OUT, d), { recursive: true })

function pngSize(file) {
  const b = fs.readFileSync(file)
  if (b.length < 24) return null
  if (b[0] === 0x89 && b[1] === 0x50) {
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20)
    return { w, h, kb: Math.round(b.length / 1024) }
  }
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2
    while (i < b.length - 9) {
      if (b[i] === 0xFF && b[i + 1] >= 0xC0 && b[i + 1] <= 0xCF && b[i + 1] !== 0xC4 && b[i + 1] !== 0xC8 && b[i + 1] !== 0xCC) {
        const h = b.readUInt16BE(i + 5), w = b.readUInt16BE(i + 7)
        return { w, h, kb: Math.round(b.length / 1024) }
      }
      i += 2
    }
    return { w: 0, h: 0, kb: Math.round(b.length / 1024) }
  }
  return { w: 0, h: 0, kb: Math.round(b.length / 1024) }
}

// ① 规格书细分.xlsx 内嵌图
const tmp = path.join(OUT, 'fenxi-tmp')
fs.mkdirSync(tmp, { recursive: true })
const xlsx = 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.1规格书/规格书细分.xlsx'
fs.copyFileSync(xlsx, path.join(tmp, 'd.zip'))
execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${path.join(tmp, 'd.zip')}' -DestinationPath '${path.join(tmp, 'x')}' -Force"`, { stdio: 'ignore' })
// 工作表名与图片对应(sheet rels → drawing → media)
const wbXml = fs.readFileSync(path.join(tmp, 'x', 'xl', 'workbook.xml'), 'utf8')
const relsXml = fs.readFileSync(path.join(tmp, 'x', 'xl', '_rels', 'workbook.xml.rels'), 'utf8')
const relMap = {}
for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2]
const sheets = []
for (const m of wbXml.matchAll(/<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
  sheets.push({ name: m[1], part: 'xl/' + relMap[m[2]].replace(/^\//, '') })
}
for (const sp of sheets) {
  const rp = path.join(tmp, 'x', sp.part.replace('worksheets/', 'worksheets/_rels/') + '.rels')
  if (!fs.existsSync(rp)) continue
  const rx = fs.readFileSync(rp, 'utf8')
  const drawings = [...rx.matchAll(/Target="([^"]+drawing[^"]+)"[^>]*\/>/g)].map((m) => 'xl/' + m[1].replace('../', ''))
  let imgInfo = []
  for (const d of drawings) {
    const dp = path.join(tmp, 'x', d)
    if (!fs.existsSync(dp)) continue
    const dx = fs.readFileSync(dp, 'utf8')
    const relp = path.join(tmp, 'x', path.dirname(d), '_rels', path.basename(d) + '.rels')
    if (!fs.existsSync(relp)) continue
    const relx = fs.readFileSync(relp, 'utf8')
    for (const m of relx.matchAll(/Target="(\.\.\/media\/[^"]+)"/g)) {
      const src = path.join(tmp, 'x', path.dirname(path.dirname(d)), m[1])
      if (fs.existsSync(src)) imgInfo.push(src)
    }
  }
  let i = 0
  for (const src of imgInfo) {
    i++
    const ext = path.extname(src) || '.png'
    const dest = path.join(OUT, 'fenxi', `${sp.name.replace(/[\\/:*?"<>|]/g, '_')}-${i}${ext}`)
    fs.copyFileSync(src, dest)
    const sz = pngSize(dest)
    console.log('规格书细分图片: ' + sp.name + ' #' + i + ' → ' + dest.replace(path.join(__dirname, ''), '') + ' (' + sz.w + 'x' + sz.h + ', ' + sz.kb + 'KB)')
  }
}
fs.rmSync(tmp, { recursive: true, force: true })

// ② 规格书示例 docx 内嵌图
const EXAMPLES = 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.1规格书/规格书示例'
for (const f of fs.readdirSync(EXAMPLES).filter((x) => x.endsWith('.docx'))) {
  const t2 = path.join(OUT, 'docx-' + f.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) + '-tmp')
  fs.mkdirSync(t2, { recursive: true })
  fs.copyFileSync(path.join(EXAMPLES, f), path.join(t2, 'd.zip'))
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${path.join(t2, 'd.zip')}' -DestinationPath '${path.join(t2, 'x')}' -Force"`, { stdio: 'ignore' })
  const mediaDir = path.join(t2, 'x', 'word', 'media')
  let n = 0
  if (fs.existsSync(mediaDir)) {
    for (const mf of fs.readdirSync(mediaDir)) {
      n++
      const dest = path.join(OUT, 'docx', f.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 36) + '-' + mf)
      fs.copyFileSync(path.join(mediaDir, mf), dest)
      const sz = pngSize(dest)
      console.log('示例图片: ' + f.slice(0, 34) + ' → ' + mf + ' (' + sz.w + 'x' + sz.h + ', ' + sz.kb + 'KB)')
    }
  }
  if (!n) console.log('示例无图: ' + f.slice(0, 34))
  fs.rmSync(t2, { recursive: true, force: true })
}
console.log('DONE → ' + OUT)
