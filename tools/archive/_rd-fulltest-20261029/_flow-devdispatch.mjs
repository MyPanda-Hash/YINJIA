/**
 * _flow-devdispatch.mjs —— 阶段6 续:「产品开发」下发 ⇒ rd_dev_task 生成 ⇒ 产品文件列表矩阵有行
 * 用法: node _flow-devdispatch.mjs <产品编号> [base]
 *
 * 背景:board()(产品文件列表矩阵)的行来自 rd_dev_task,**只有点「产品开发」下发后才产生**;
 *   四份文件归档本身不会自动建任务行 —— 这是设计(用户要先点产品开发才进入开发流程)。
 *   本脚本按下发,再验矩阵。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const PROD = process.argv[2] || 'YJ-CB-2026-001'
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
const out = []
let fails = 0
const log = (k, v) => { out.push({ step: k, result: v }); console.log('\n── ' + k + ' ──'); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fails++; return !!c }

function q(sql) {
  return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' }).trim()
}
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

// 找到该产品的产品信息表单号(按钮挂在 RD_PROD_INFO 上)
const piNo = (q(`SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y'`)
  .split(/\r?\n/).map((s) => s.trim()).find((l) => /^PI-/.test(l)) || '')
log('产品信息表单号', piNo)

// 「产品开发」按钮
const dev = await (await fetch(BASE + '/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName: '产品开发', formData: { 编号: piNo }, buttonParam: {} }),
})).json()
log('1.产品开发下发', { code: dev.code, msg: String(dev.message).slice(0, 200) })
ok(dev.code === 200, '「产品开发」下发成功')

log('2.rd_dev_task 行', q(`SELECT 产品编号, 产品名称, 源单据号, 目标面板, 负责人, ISNULL(asp_cancel,'N') AS 作废 FROM rd_dev_task WHERE 产品编号='${PROD}' ORDER BY 目标面板`))
const nTasks = q(`SELECT COUNT(*) AS n FROM rd_dev_task WHERE 产品编号='${PROD}' AND ISNULL(asp_cancel,'N')<>'Y'`)
log('2b.任务数', nTasks)

// 3. 产品文件列表矩阵
const pdl = await (await fetch(BASE + '/api/px/prodDocList', { headers: H })).json()
const rows = pdl?.data?.rows || []
const mine = rows.find((r) => String(r['产品编号'] ?? '') === PROD)
log('3.矩阵行', mine ? { 产品编号: mine['产品编号'], cells: mine.cells, doneCount: mine.doneCount, totalCount: mine.totalCount, overall: mine.overall, 产品负责人: mine['产品负责人'] } : '(仍无行)')
ok(!!mine, '产品已出现在产品文件列表矩阵')
if (mine) {
  ok(mine.doneCount === mine.totalCount, `四份文件全部「开发完毕」(${mine.doneCount}/${mine.totalCount})`)
}

await fs.writeFile(new URL('./out-flow-devdispatch.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段6续 结果: 失败 ' + fails + ' 项 ════')
