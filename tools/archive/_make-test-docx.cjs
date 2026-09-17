// _make-test-docx.cjs — 手工构造最小合法 .docx(OOXML zip,stored 条目+CRC32)并经 API 上传
const zlib = require('zlib')
const fs = require('fs')

// ── zip 构造(stored 无压缩,最简实现) ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function zipStore(files) {
  const chunks = []
  const central = []
  let offset = 0
  for (const [name, data] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 文件名标志
    local.writeUInt16LE(0, 8) // stored
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    chunks.push(local, nameBuf, data)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt16LE(0, 10)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([cd, nameBuf]))
    offset += local.length + nameBuf.length + data.length
  }
  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(Object.keys(files).length, 8)
  eocd.writeUInt16LE(Object.keys(files).length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, cdBuf, eocd])
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function para(text, bold) {
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
}
const body = [
  para('Word 预览机制验证文档', true),
  para(''),
  para('此文档由自动化脚本生成,用于验证共享文件库的 docx 在线预览链路。'),
  para('验证点:docx-preview 渲染、占位窗口写入、中文内容完整性。'),
  para('验证完成后此文件将被删除。'),
].join('')

const docx = zipStore({
  '[Content_Types].xml': Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  ),
  '_rels/.rels': Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  ),
  'word/document.xml': Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"/></w:sectPr></w:body></w:document>`
  ),
})

async function main() {
  const login = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YINJIA-MES' }),
  }).then((r) => r.json())
  const H = { Authorization: 'Bearer ' + login.data.token }
  const cats = await fetch('http://127.0.0.1:8090/api/share-file/categories', { headers: H }).then((r) => r.json())
  const cat = cats.data.find((c) => c.name === '企标')
  const fd = new FormData()
  fd.append('file', new File([docx], 'Word预览验证.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
  fd.append('catId', String(cat.id))
  fd.append('name', 'Word预览验证')
  const up = await fetch('http://127.0.0.1:8090/api/share-file/upload', { method: 'POST', headers: H, body: fd }).then((r) => r.json())
  console.log('upload:', JSON.stringify(up))
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
