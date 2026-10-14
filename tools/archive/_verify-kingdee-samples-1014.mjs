/**
 * Phase 3 核对(2026-10-14):把写入**测试账套**的样例单据与金蝶原始返回**逐字段比对**。
 *
 * 为什么单独一步:「拉取一条数据方便做核对」的落点就是这张表 —— 每类单据挑关键字段,
 *   左列金蝶原值、右列 MES 落库值,不一致直接标 ❌(若失败即说明映射或字段登记有问题)。
 *
 * 用法: node tools/archive/_verify-kingdee-samples-1014.mjs
 * 产物: tools/archive/_dump-out/kingdee-samples-verify-1014.md
 */
import { readFileSync, writeFileSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'

const dump = JSON.parse(readFileSync(new URL('./_dump-out/kingdee-samples-1014.json', import.meta.url), 'utf8'))
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST',
  user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})

const S = (v) => {
  if (v === undefined || v === null) return ''
  // mssql 把 date/datetime 返回成 JS Date ⇒ 按 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss 归一,否则比不出结果
  if (v instanceof Date) {
    const p = (x) => String(x).padStart(2, '0')
    const d = `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
    return (v.getHours() || v.getMinutes() || v.getSeconds()) ? `${d} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}` : d
  }
  return String(v).trim()
}
const md = ['# 取样核对:金蝶原值 ↔ MES 落库值(测试账套 HSDZ_MES_TEST)', '',
  `- 生成时间:${new Date().toISOString()}`, '- 口径:MES 侧取值来自物理表;金蝶侧取值来自取样时的详情返回', '']

const CASES = [
  {
    api: 'inv_product', label: '产品入库单', head: 'bd_finish_in', line: 'bl_finish_in',
    headPairs: [['bill_no', '单据编号'], ['id', '外部数据ID'], ['bill_date', '单据日期'], ['bill_type_name', '业务类型'],
      ['dept_name', '部门'], ['dept_number', '部门编码'], ['emp_name', '经手人'], ['auditor_name', '审核人']],
    linePairs: [['seq', '序号'], ['material_number', '产品编码'], ['material_name', '产品名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['unit_name', '计量单位'], ['qty', '实收数量'], ['batch_no', '批号'], ['inv_qty', '库存数量']],
  },
  {
    api: 'inv_other_in', label: '其他入库单', head: 'bd_other_in', line: 'bl_other_in',
    headPairs: [['bill_no', '单据编号'], ['id', '外部数据ID'], ['bill_date', '单据日期'], ['trans_type_name', '业务类型'],
      ['trans_type_number', '业务类型编码'], ['trans_type_id', '业务类型id'], ['supplier_number', '供应商编码'], ['supplier_name', '供应商']],
    linePairs: [['seq', '序号'], ['material_number', '存货编码'], ['material_name', '存货名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['stock_number', '仓库编码'], ['unit_name', '计量单位'], ['qty', '数量'], ['cost', '成本'], ['unit_cost', '单位成本']],
  },
  {
    api: 'inv_other_out', label: '其他出库单', head: 'bd_other_out', line: 'bl_other_out',
    headPairs: [['bill_no', '单据编号'], ['id', '外部数据ID'], ['bill_date', '单据日期'], ['trans_type_name', '业务类型'],
      ['trans_type_id', '业务类型id'], ['dept_name', '部门'], ['dept_number', '部门编码'], ['emp_name', '经手人']],
    linePairs: [['seq', '序号'], ['material_number', '存货编码'], ['material_name', '存货名称'], ['stock_name', '仓库'],
      ['stock_number', '仓库编码'], ['unit_name', '计量单位'], ['qty', '数量'], ['batch_no', '批号'], ['inv_qty', '库存数量']],
  },
]

let bad = 0
for (const c of CASES) {
  const sm = dump.samples[c.api]
  const billNo = sm.bill_no
  const head = (await pool.request().query(`SELECT * FROM ${c.head} WHERE 单据编号 = N'${billNo.replace(/'/g, "''")}'`)).recordset[0] || {}
  const lines = (await pool.request().query(`SELECT * FROM ${c.line} WHERE 单据编号 = N'${billNo.replace(/'/g, "''")}' ORDER BY id`)).recordset || []
  md.push(`## ${c.label}(${c.api})—— 取样 \`${billNo}\``, '')
  md.push(`- 金蝶分录 ${sm.entries.length} 行 / MES 明细写入 ${lines.length} 行`, '')
  md.push('### 表头逐字段', '', '| 金蝶键 | 金蝶原值 | MES 列 | MES 落库值 | 一致 |', '|---|---|---|---|---|')
  for (const [kd, col] of c.headPairs) {
    const a = S(sm.header[kd]), b = S(head[col])
    // 金蝶时间是 'yyyy-MM-dd HH:mm:ss',MES 审核时间是 datetime2,比较时按前 19 位
    const ok = a === b || (a && b && (b.startsWith(a) || a.startsWith(b)))
    if (!ok) bad++
    md.push(`| \`${kd}\` | ${a.slice(0, 40)} | \`${col}\` | ${b.slice(0, 40)} | ${ok ? '✅' : '❌'} |`)
  }
  md.push('', '### 分录逐字段(首行)', '', '| 金蝶键 | 金蝶原值 | MES 列 | MES 落库值 | 一致 |', '|---|---|---|---|---|')
  const e0 = sm.entries[0] || {}, l0 = lines[0] || {}
  for (const [kd, col] of c.linePairs) {
    const a = S(e0[kd]), b = S(l0[col])
    const ok = a === b || (a && b && Number(a) === Number(b)) || (!a && !b)
    if (!ok) bad++
    md.push(`| \`${kd}\` | ${a.slice(0, 40)} | \`${col}\` | ${b.slice(0, 40)} | ${ok ? '✅' : '❌'} |`)
  }
  md.push('')
}
md.push('## 结论', '', bad === 0 ? '**全部关键字段一致(✅)** —— 映射与字段登记可用。' : `**有 ${bad} 处不一致(❌)**,见上表。`, '')
writeFileSync(new URL('./_dump-out/kingdee-samples-verify-1014.md', import.meta.url), md.join('\n'), 'utf8')
await pool.close()
console.log(md.filter((x) => x.startsWith('| `')).join('\n'))
console.log(`\n不一致处 = ${bad}`)
console.log('[产物] tools/archive/_dump-out/kingdee-samples-verify-1014.md')
