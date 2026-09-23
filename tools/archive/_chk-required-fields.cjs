/**
 * _chk-required-fields.cjs — 统计研发管理各面板的**必填字段**,评估"保存/提交做后端必填校验"的影响面
 *
 * 为什么要先量:后端目前**没有任何必填校验**(只在审批驳回落意见时有);真正执行必填校验
 * 会改变行为 —— 若某面板的必填字段在正常流程里本就为空,就会把原来能保存的单卡住。
 * 先量清"有多少必填、都是哪些",再决定怎么加。
 *
 * 用法:node tools/archive/_chk-required-fields.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

const rows = sql(`SELECT panel_code, place, col_name, label FROM yj_field
  WHERE panel_code LIKE 'RD[_]%' AND required = 1 ORDER BY panel_code, place, seq`)
  .split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((l) => l.split('\t').map((x) => (x || '').trim()))

console.log('研发管理必填字段总数 =', rows.length)
const byPanel = new Map()
for (const [p] of rows) byPanel.set(p, (byPanel.get(p) || 0) + 1)
console.log('')
console.log('=== 各面板必填数 ===')
for (const [p, n] of [...byPanel.entries()].sort()) console.log(`  ${p.padEnd(20)} ${n} 个`)

console.log('')
console.log('=== 全部必填字段(面板 | 位置 | 列 | 标签)===')
for (const [p, place, col, label] of rows) console.log(`  ${p.padEnd(18)} ${(place || '').padEnd(7)} ${col.padEnd(20)} ${label}`)

// 系统字段(后端自动填/不需要用户填写)不该参与校验
const SYS = new Set(['单据编号', '单据日期', '创建时间', '编辑人', '编辑日期'])
const runtime = rows.filter(([, , col]) => !SYS.has(col))
console.log('')
console.log(`需用户填写的必填(排除系统字段 ${[...SYS].join('/')})= ${runtime.length}`)
const byPanel2 = new Map()
for (const [p] of runtime) byPanel2.set(p, (byPanel2.get(p) || 0) + 1)
for (const [p, n] of [...byPanel2.entries()].sort()) console.log(`  ${p.padEnd(20)} ${n} 个`)
