/**
 * _chk-no-reissue.cjs — 量化"编号会被重发"的风险面(只读)
 *
 * 缺陷根因:FormNoService.next() 发号时 exists() 只查 s_allno.dh / inh.inh_no,
 * **不查业务表**。凡是业务表里存在、但台账里没有的单据编号,都会被重新发给新单
 * ⇒ 两张单共用一个编号(头表出现同号两行)、保存写到错误的行。
 *
 * 本探针按面板统计:业务表(头表)中 前缀-yyyy-MM-% 形态的编号里,台账缺几条。
 * 用法:node tools/archive/_chk-no-reissue.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 1 << 26 }).trim()
const lines = (q) => s(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

const ny = new Date().toISOString().slice(0, 7)  // yyyy-MM

const panels = lines(`SELECT panel_code+'|'+ISNULL(head_table,'')+'|'+ISNULL(prefix,'')+'|'+ISNULL(group_col,'')
  FROM yj_panel WHERE mode='doc' AND ISNULL(head_table,'')<>'' AND ISNULL(prefix,'')<>'' ORDER BY panel_code`)

console.log(`当前月份 ny=${ny}`)
console.log('面板 | 业务表同月编号数 | 台账缺号数 | 缺号示例')
console.log('----')
let risky = 0, totalMissing = 0
for (const row of panels) {
  const [code, head, prefix, groupCol] = row.split('|')
  const exists = lines(`SELECT COUNT(*) FROM sys.tables WHERE name='${head}'`)[0]
  if (exists !== '1') continue
  const hasCol = lines(`SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('${head}') AND name=N'${groupCol}'`)[0]
  if (hasCol !== '1') continue
  const like = `${prefix}-${ny}-%`
  const biz = lines(`SELECT COUNT(*) FROM ${head} WHERE ${groupCol} LIKE '${like}'`)[0]
  if (biz === '0') continue
  const missing = lines(`SELECT COUNT(*) FROM ${head} h WHERE h.${groupCol} LIKE '${like}'
    AND NOT EXISTS (SELECT 1 FROM s_allno a WHERE a.dh = h.${groupCol})`)[0]
  const sample = lines(`SELECT TOP 5 h.${groupCol} FROM ${head} h WHERE h.${groupCol} LIKE '${like}'
    AND NOT EXISTS (SELECT 1 FROM s_allno a WHERE a.dh = h.${groupCol}) ORDER BY h.${groupCol}`).join(' ')
  if (Number(missing) > 0) { risky++; totalMissing += Number(missing) }
  console.log(`${code} | ${biz} | ${missing} | ${sample || '-'}`)
}

console.log('')
console.log(`受影响面板 = ${risky}   会重发的编号总数 = ${totalMissing}`)

console.log('')
console.log('=== 已出现"同号两行"的业务表(实际损坏证据,全库扫描)===')
console.log(lines(`SELECT 'h.' + t.name + ' | ' + c.name AS tbl_col FROM sys.tables t
  JOIN sys.columns c ON c.object_id=t.object_id AND c.name IN (N'单据编号',N'文档编号')
  WHERE t.name LIKE '%[_]head'`).length + ' 张头表候选(逐表扫描可能较慢,见下)')
