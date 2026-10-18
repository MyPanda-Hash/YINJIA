/**
 * 期初数据 → Excel(给用户留存/核对/上传远端用)
 *
 * 产出两个 .xlsx:
 *   ① 期初-A-0831.xlsx  金蝶 2026-08-31 结存(point_date 口径,1345 行)
 *   ② 期初-B-0901.xlsx  金蝶 2026-09-01 期初(现存量 − 9/1后净额,1925 行)
 * 每个文件含「期初明细」页,并附「口径说明」页写清楚这是哪一种、怎么算的。
 *
 * 零依赖:直接写 OOXML(zip 由 node:zlib 手工封装),不引第三方库。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const OUT = new URL('./_out/', import.meta.url)
mkdirSync(OUT, { recursive: true })

// ───────────── 最小 zip 写入器(OOXML 打包)─────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function zip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of files) {
    const nameBuf = Buffer.from(name, 'utf8')
    const data = Buffer.from(content, 'utf8')
    const comp = deflateRawSync(data, { level: 9 })
    const crc = crc32(data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0x0800, 6)   // UTF-8 文件名
    lh.writeUInt16LE(8, 8)        // deflate
    lh.writeUInt16LE(0, 10)
    lh.writeUInt16LE(0, 12)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(comp.length, 18)
    lh.writeUInt32LE(data.length, 22)
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)
    locals.push(lh, nameBuf, comp)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt16LE(8, 10)
    ch.writeUInt16LE(0, 12)
    ch.writeUInt16LE(0, 14)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(comp.length, 20)
    ch.writeUInt32LE(data.length, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt16LE(0, 30)
    ch.writeUInt16LE(0, 32)
    ch.writeUInt16LE(0, 34)
    ch.writeUInt16LE(0, 36)
    ch.writeUInt32LE(0, 38)
    ch.writeUInt32LE(offset, 42)
    centrals.push(ch, nameBuf)
    offset += lh.length + nameBuf.length + comp.length
  }
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, centralBuf, end])
}

// ───────────── XLSX 生成 ─────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const colName = (i) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(((n - 1) % 26) + 65) + s
  return s
}

/** sheets: [{ name, rows: [[c1,c2,...]], widths:[..], headerRows:1 }] */
function buildXlsx(sheets) {
  const sst = []
  const sstIndex = new Map()
  const strId = (v) => {
    if (!sstIndex.has(v)) { sstIndex.set(v, sst.length); sst.push(v) }
    return sstIndex.get(v)
  }
  const sheetXml = sheets.map((sh) => {
    const rowsXml = sh.rows.map((row, ri) => {
      const cells = row.map((v, ci) => {
        const ref = colName(ci) + (ri + 1)
        if (v === null || v === undefined || v === '') return `<c r="${ref}"/>`
        if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`
        return `<c r="${ref}" t="s"><v>${strId(String(v))}</v></c>`
      }).join('')
      return `<row r="${ri + 1}">${cells}</row>`
    }).join('')
    const cols = (sh.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freeze ?? 1}" topLeftCell="A${(sh.freeze ?? 1) + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols><sheetData>${rowsXml}</sheetData></worksheet>`
  })

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">
${sst.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}
</sst>`

  const files = [
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRels],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', wbRels],
    ['xl/sharedStrings.xml', sstXml],
    ...sheetXml.map((x, i) => [`xl/worksheets/sheet${i + 1}.xml`, x]),
  ]
  return zip(files)
}

// ───────────── 读期初数据 ─────────────
const load = (f) => JSON.parse(readFileSync(new URL(f, OUT), 'utf8'))
// ⚠ 期初必须用**带批号**的那份:不带批号的版本会让全部期初落在"无批号行",
//   与 MES 的 PC0000 口径永远对不上(实测负结存 785 → 带批号后 535)
// ⚠ 2026-10-19 起 PC0000 已在库里归一为「无批号」(migrate-pc0000-to-null-20261019.sql),
//   故导出 Excel 时同步把 PC0000 显示成空 —— 否则表与实际库存口径不一致。
const normalizeLot = (r) => ({ ...r, lot: (!r.lot || r.lot.toUpperCase() === 'PC0000') ? null : r.lot })
const A = load('./opening-A-0831-lot.json').map(normalizeLot)
const B = load('./opening-B-0901.json').map(normalizeLot)

// MES 侧对照:当前结存 + 9/1后流水净额
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const mesNet = await q(`
  SELECT wzdm, ckdm, lot, SUM(qty) AS net FROM (
    SELECT RTRIM(物料编码) AS wzdm, ISNULL(RTRIM(仓库编码),N'') AS ckdm, ISNULL(RTRIM(批号),N'') AS lot, 数量 AS qty
      FROM inh WHERE src BETWEEN 1 AND 8 AND ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-09-01'
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''), -数量
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-09-01'
  ) x GROUP BY wzdm, ckdm, lot`)
const kucun = await q(`SELECT wzdm, ckdm, lot_no, yl FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'`)
// 档案名称(物料/仓库):优先用 MES 档案,缺失时退回金蝶返回的名称
const invRows = await q(`SELECT 存货编码 AS code, 存货名称 AS name FROM bs_inv`)
const whRows = await q(`SELECT 仓库编码 AS code, 仓库名称 AS name FROM bs_wh`)
await pool.close()
const INV_NAME = new Map(invRows.map((r) => [String(r.code).trim(), r.name]))
const WH_NAME = new Map(whRows.map((r) => [String(r.code).trim(), r.name]))
const k = (w, c, l) => `${w}|${c}|${l || ''}`
const mesNetMap = new Map(mesNet.map((r) => [k(r.wzdm, r.ckdm, r.lot), Number(r.net || 0)]))
const kucunMap = new Map(kucun.map((r) => [k(r.wzdm, r.ckdm, r.lot_no), Number(r.yl || 0)]))

const HEAD = ['物料编码', '物料名称', '仓库编码', '仓库名称', '批号', '期初数量', 'MES当前结存', 'MES9/1后流水净额', '备注']
const WIDTHS = [18, 26, 12, 16, 20, 14, 16, 20, 30]
const note = (op, mn, cur) => {
  if (cur === undefined) return 'MES无此键'
  const calc = op + mn
  if (Math.abs(calc - cur) > 0.0001) return '与MES当前不一致'
  return ''
}
function detailRows(list) {
  return list.map((r) => {
    const key = k(r.wzdm, r.ckdm, r.lot)
    const mn = mesNetMap.get(key) ?? 0
    const cur = kucunMap.get(key)
    const inv = INV_NAME.get(String(r.wzdm).trim()) || r.name || ''
    const wh = WH_NAME.get(String(r.ckdm).trim()) || r.ckName || ''
    return [r.wzdm, inv, r.ckdm, wh, r.lot ?? '', r.qty, cur ?? '', mn, note(r.qty, mn, cur)]
  })
}

function writeOne(file, title, subtitle, list) {
  const total = list.reduce((s, r) => s + r.qty, 0)
  const neg = list.filter((r) => r.qty < 0).length
  const info = [
    ['项目', '值'],
    ['工作表用途', title],
    ['口径说明', subtitle],
    ['数据来源', '金蝶云·星辰 真实账套 clientId=359797 / outerInstanceId=580147507460444160'],
    ['导出时间', new Date().toISOString()],
    ['行数', list.length],
    ['期初数量合计', Number(total.toFixed(4))],
    ['其中负值行数', neg],
    ['', ''],
    ['⚠ 导入前必读', '本表是「金蝶期初」原始数据,导入 MES 前必须先清空既有期初(INIT-* / JZ-* / kucun)'],
    ['⚠ 导入规则', 'inh 写 src=0 / 单据类型=期初结存 / 单据日期=1900-01-01;kucun 同键有则改无则增'],
    ['⚠ 上线提醒', '正式上线当天须按上线日重导期初,详见 docs/development/上线前必验-库存批次追溯.md'],
  ]
  const xlsx = buildXlsx([
    { name: '口径说明', rows: info, widths: [22, 96], freeze: 1 },
    { name: '期初明细', rows: [HEAD, ...detailRows(list)], widths: WIDTHS, freeze: 1 },
  ])
  writeFileSync(new URL(file, OUT), xlsx)
  console.log(`  ✅ ${file}  ${list.length} 行 / 合计 ${total.toFixed(2)} / 负值 ${neg} 行`)
}

writeOne('期初-A-0831.xlsx', '金蝶 2026-08-31 结存(方案A · 带批号)',
  '取金蝶 point_date=2026-08-31 的时点库存,且 include_batch_kf_period=true(按批次拆行)。'
  + '⚠ 不传 include_batch_kf_period 时该接口 batch_no 恒空,期初会全部落在"无批号行",与 MES 的 PC0000 口径对不上。', A)
writeOne('期初-B-0901.xlsx', '金蝶 2026-09-01 期初(方案B)',
  '倒挤:金蝶当前现存量 − 金蝶 2026-09-01 起的真实收发净额。与 MES 9/1 后单据直接衔接。', B)

console.log('\n[产物] tools/archive/_kd-opening-probe/_out/期初-A-0831.xlsx · 期初-B-0901.xlsx')
