#!/usr/bin/env node
/**
 * 一次性取证 —— YJ-QR-154《出货检验功能记录表》Excel 版式真的能落进 .xlsx 吗?
 *
 * 背景:导出模块只产 aoa/cols/merges(纯函数、不 import xlsx),组件那层才做
 * `XLSX.utils.aoa_to_sheet` + `!cols` + `!merges` + `writeFile`。所以「版式对不对」必须
 * **看写出来的文件**,只看内存数组会被社区版 xlsx 的静默丢弃骗过去(见模块头部取证)。
 *
 * 本脚本:用 3 个批次造一张示例表 → 写临时 .xlsx → 解压 xl/worksheets/sheet1.xml →
 * 数 `<col>` 与 `<mergeCell>` 并打印,验证列宽/合并区**确实**写进了文件。
 * (2026-10-17 老版同样这么验过;Excel 里没有框线/样式是 xlsx 社区版限制,见模块头注释。)
 *
 * 用法(仓库根):node tools/archive/_qc-form-yj154-20261111/_probe-xlsx-layout.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(HERE, '../../../frontend')

const { buildProcInspExport, batchListOf } = await import(
  pathToFileURL(join(FRONTEND, 'src/core/qc/qcProcInspExport.js')).href
)
const XLSX = await import(pathToFileURL(join(FRONTEND, 'node_modules/xlsx/xlsx.mjs')).href)

const batches = ['261105', '261107', '261108']
const out = buildProcInspExport({
  title: '出货检验功能记录表',
  subtitle: '惠州市银嘉环保科技有限公司　　单据编号：ZC-2026-11-0001　　单据状态：草稿',
  headPairs: [
    [{ label: '单据编号', value: 'ZC-2026-11-0001' }, { label: '检测周期', value: '2026-11-05 ~ 2026-11-11' }],
    [{ label: '产品编码', value: 'S032-3' }, { label: '工单号', value: 'WO-2026-11-0001' }],
    [{ label: '产品型号', value: '28*12*178' }, { label: '抽检方案', value: 'Y料成品检验方案' }],
  ],
  batches,
  rows: [
    { 检验项目: '外观', 检验方法: '目视', 检验要求: '无破损、无变形', 结果: { 261105: '合格', 261107: '合格', 261108: '不合格' } },
    { 检验项目: '尺寸', 检验方法: '卡尺', 检验要求: '28±0.5mm', 结果: { 261105: '合格', 261107: '合格' } },
  ],
  foot: [
    { label: '检验人', value: '张三' },
    { label: '检验结论', value: '合格' },
    { label: '审核人', value: '冯敏' },
    { label: '处理意见', value: '允收' },
  ],
})

const ws = XLSX.utils.aoa_to_sheet(out.aoa)
ws['!cols'] = out.cols
ws['!merges'] = out.merges
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '出货检验功能记录表')
const file = join(tmpdir(), '_qc_yj154_probe.xlsx')
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
writeFileSync(file, buf)

/** 从 zip 中央目录取 xl/worksheets/sheet1.xml 并解压(不引第三方 zip 库) */
function sheetXml(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const cmtLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8')
    if (name === 'xl/worksheets/sheet1.xml') {
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const start = localOff + 30 + lNameLen + lExtraLen
      const comp = buf.slice(start, start + compSize)
      return (method === 0 ? comp : inflateRawSync(comp)).toString('utf8')
    }
    p += 46 + nameLen + extraLen + cmtLen
  }
  throw new Error('zip 里找不到 xl/worksheets/sheet1.xml')
}

const xml = sheetXml(buf)
const cols = (xml.match(/<col /g) || []).length
const mergeCells = (xml.match(/<mergeCell /g) || []).length
const merges = (xml.match(/<mergeCell ref="[^"]+"/g) || []).map((s) => s.match(/ref="([^"]+)"/)[1])

console.log(`临时文件:${file}(${buf.length} 字节)`)
console.log(`1) 物料清单:批次列 = ${JSON.stringify(batchListOf({ 内部批次清单: batches.join(',') }))}`)
console.log(`   旧单 batchListOf({批次号:'20261014'}) = ${JSON.stringify(batchListOf({ 批次号: '20261014' }))}`)
console.log(`2) sheet1.xml:<col> ${cols} 个(期望 ${3 + 2 * batches.length} = 3 固定列 + 每批 2 列)`)
console.log(`3) sheet1.xml:<mergeCell> ${mergeCells} 个(期望 14 = 标题 2 + 副标题 1 + 抬头 3×2 + 检验明细 1 + 表尾 2×2)`)
console.log(`   前 6 个:${merges.slice(0, 6).join(' / ')}`)
console.log(`4) 表格范围 = ${XLSX.utils.decode_range(ws['!ref']) ? out.colCount : '?'} 列 × ${out.aoa.length} 行(期望 ${out.colCount} × ${out.aoa.length})`)
const ok = cols === 3 + 2 * batches.length && mergeCells === 14 && out.colCount === 3 + 2 * batches.length
console.log(ok ? '\n版式取证 [PASS]:列宽与合并区都写进了 .xlsx' : '\n版式取证 [FAIL]')
process.exit(ok ? 0 : 1)
