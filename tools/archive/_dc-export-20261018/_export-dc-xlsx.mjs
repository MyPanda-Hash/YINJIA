/**
 * 导出「数采平台」数据 → Excel(.xlsx),随仓库推送到云端(2026-10-18)
 *
 * 【用户口径】「把数采平台的数据也传上去」。沿用 db/emp-data-20261018 与
 *   db/quality-data-20261018 的先例:导出 → 放 db/<主题>-<日期>/ → 提交推送。
 *
 * 【🔴 安全口径】`bs_dc_gateway.api_key` 是硬件上报的**接入密钥**(POST /api/dc/ingest 的
 *   X-DC-Key 必须等于它),`MyPanda-Hash/YINJIA` 是**公开仓库** ⇒ 密钥**一律不导出**,
 *   连前缀/长度都不写;表里只给一列「密钥已设置 = 是/否」。
 *   其余字段按「业务事实数据原样保留」处理(ADR-0001 同类口径):
 *     · 设备 IP(192.168.x.x,内网 RFC1918)与序列号保留 —— 设备台账就是给人看"怎么配的",
 *       打码后失去参考价值;但 README 里明确写「含内网设备地址,不要对外再分发」。
 *     · 采集流水里的 value_text 可能是条码(物料编码+批号),属业务数据,原样保留。
 *
 * 【数据源】正式账套 HSDZ_MES · bs_dc_* 七张表。测试账套是快照副本,不重复导出。
 *
 * 【产物】db/dc-data-20261018/数采平台数据-20261018.xlsx,九个页签:
 *   概览 / 网关台账 / 设备台账 / 采集点 / 数采规则 / 采集流水 / 报警记录 / 在线状态日志 / 数据说明
 *
 * 【自检】导出后读回:①行数与库一致;②全表扫描确认 api_key 值**一个都没出现在任何单元格**;
 *   ③页签齐全。任一 [FAIL] 直接 exit 1,不产出可用结论。
 *
 * 用法: node tools/archive/_dc-export-20261018/_export-dc-xlsx.mjs [--db HSDZ_MES] [--out <dir>]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const XLSX = require('../../../frontend/node_modules/xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..', '..')
const argv = process.argv.slice(2)
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const DB = argOf('--db', 'HSDZ_MES')
const STAMP = '20261018'
const OUTDIR = argOf('--out', path.join(ROOT, 'db', 'dc-data-' + STAMP))

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB,
  user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true, loginTimeout: 10 },
})

const q = async (sql) => (await pool.request().query(sql)).recordset

/* ── 取数(api_key 只取"是否非空",不取内容) ── */
const gateways = await q(`
  SELECT code AS 网关编码, name AS 网关名称, protocol AS 通信协议, host AS 地址, port AS 端口,
         CASE WHEN ISNULL(api_key,'')='' THEN N'否' ELSE N'是' END AS 密钥已设置,
         CASE WHEN status='online' THEN N'在线' ELSE N'离线' END AS 状态,
         CONVERT(varchar(19), last_seen_at, 120) AS 最近上报,
         CASE WHEN enabled='Y' THEN N'启用' ELSE N'停用' END AS 启用, remark AS 备注
    FROM bs_dc_gateway
   WHERE ISNULL(asp_cancel,'N')<>'Y'
   ORDER BY code`)

const devices = await q(`
  SELECT d.code AS 设备编码, d.name AS 设备名称, d.device_type AS 设备类型, d.model AS 型号,
         d.serial_no AS 序列号, ISNULL(g.code,N'') AS 网关编码, ISNULL(g.name,N'') AS 网关名称,
         d.ip AS IP, d.port AS 端口, d.workshop AS 车间, ISNULL(d.project_code,N'') AS 数采工程,
         CASE WHEN d.scada_drawn='Y' THEN N'是' ELSE N'否' END AS 已绘制组态,
         CONVERT(varchar(19), d.last_debug_at, 120) AS 调试通过时间,
         d.heartbeat_seconds AS 心跳秒,
         CASE WHEN d.status='online' THEN N'在线' ELSE N'离线' END AS 状态,
         CONVERT(varchar(19), d.last_seen_at, 120) AS 最近上报,
         (SELECT COUNT(1) FROM bs_dc_point p WHERE p.device_id=d.id AND ISNULL(p.asp_cancel,'N')<>'Y') AS 采集点数,
         (SELECT COUNT(1) FROM bs_dc_rule r WHERE r.device_id=d.id AND ISNULL(r.asp_cancel,'N')<>'Y') AS 规则数,
         (SELECT COUNT(1) FROM bs_dc_sample s WHERE s.device_id=d.id) AS 流水条数,
         (SELECT COUNT(1) FROM bs_dc_alarm a WHERE a.device_id=d.id AND ISNULL(a.state,N'')<>N'已处理' AND ISNULL(a.asp_cancel,'N')<>'Y') AS 未处理报警
    FROM bs_dc_device d
    LEFT JOIN bs_dc_gateway g ON g.id = d.gateway_id
   WHERE ISNULL(d.asp_cancel,'N')<>'Y'
   ORDER BY d.code`)

const points = await q(`
  SELECT d.code AS 设备编码, d.name AS 设备名称, p.code AS 采集点编码, p.name AS 采集点名称,
         p.data_type AS 数据类型, p.unit AS 单位, ISNULL(p.addr,N'') AS 地址,
         p.freq_seconds AS 采集频率秒, p.low_limit AS 下限, p.high_limit AS 上限,
         p.sort_no AS 排序, CASE WHEN p.enabled='Y' THEN N'启用' ELSE N'停用' END AS 启用
    FROM bs_dc_point p JOIN bs_dc_device d ON d.id = p.device_id
   WHERE ISNULL(p.asp_cancel,'N')<>'Y'
   ORDER BY d.code, p.sort_no, p.id`)

const rules = await q(`
  SELECT d.code AS 设备编码, d.name AS 设备名称, r.name AS 规则名称, r.rule_type AS 规则类型,
         ISNULL(r.expression,N'') AS 规则表达式, ISNULL(r.params,N'') AS 参数,
         CASE WHEN r.enabled='Y' THEN N'启用' ELSE N'停用' END AS 启用
    FROM bs_dc_rule r JOIN bs_dc_device d ON d.id = r.device_id
   WHERE ISNULL(r.asp_cancel,'N')<>'Y'
   ORDER BY d.code, r.id`)

const samples = await q(`
  SELECT s.id AS 流水ID, d.code AS 设备编码, d.name AS 设备名称,
         p.code AS 采集点编码, p.name AS 采集点名称,
         s.value_num AS 数值, ISNULL(s.value_text,N'') AS 文本值,
         ISNULL(s.quality,N'') AS 质量码, CONVERT(varchar(19), s.collect_at, 120) AS 采集时间
    FROM bs_dc_sample s
    LEFT JOIN bs_dc_device d ON d.id = s.device_id
    LEFT JOIN bs_dc_point p ON p.id = s.point_id
   ORDER BY s.collect_at DESC, s.id DESC`)

const alarms = await q(`
  SELECT a.id AS 报警ID, d.code AS 设备编码, d.name AS 设备名称,
         p.code AS 采集点编码, p.name AS 采集点名称, a.level AS 级别,
         a.message AS 报警内容, ISNULL(a.value_text,N'') AS 采集值,
         CONVERT(varchar(19), a.occur_at, 120) AS 发生时间, a.state AS 状态,
         ISNULL(a.handled_by,N'') AS 处理人, CONVERT(varchar(19), a.handled_at, 120) AS 处理时间,
         ISNULL(a.handled_note,N'') AS 处理备注
    FROM bs_dc_alarm a
    LEFT JOIN bs_dc_device d ON d.id = a.device_id
    LEFT JOIN bs_dc_point p ON p.id = a.point_id
   WHERE ISNULL(a.asp_cancel,'N')<>'Y'
   ORDER BY a.occur_at DESC, a.id DESC`)

const statusLogs = await q(`
  SELECT s.id AS 日志ID, d.code AS 设备编码, d.name AS 设备名称,
         CASE WHEN s.status='online' THEN N'在线' ELSE N'离线' END AS 状态,
         CONVERT(varchar(19), s.changed_at, 120) AS 变更时间, ISNULL(s.reason,N'') AS 原因
    FROM bs_dc_status_log s LEFT JOIN bs_dc_device d ON d.id = s.device_id
   WHERE ISNULL(s.asp_cancel,'N')<>'Y'
   ORDER BY s.changed_at DESC, s.id DESC`)

await pool.close()

/* ── 概览 ── */
const overview = [
  ['网关', gateways.length, '台账里登记的数采网关(密钥是否已设置见「网关台账」)'],
  ['设备', devices.length, '设备台账(电子秤/扫码枪/看板/PLC 等)'],
  ['其中已接入(在线)', devices.filter((d) => d['状态'] === '在线').length, 'status=online'],
  ['采集点', points.length, '设备下的采集变量'],
  ['数采规则', rules.length, '定时采集 / 变化上报 / 越限报警'],
  ['采集流水', samples.length, '网关上报的实时数据(只增不改)'],
  ['报警记录', alarms.length, `其中未处理 ${alarms.filter((a) => a['状态'] !== '已处理').length} 条`],
  ['在线状态日志', statusLogs.length, '状态变更留痕,在线率统计依据'],
  ['导出时间', new Date().toISOString().replace('T', ' ').slice(0, 19), '库里数据是这一刻的快照'],
]

/* ── 写 xlsx ── */
const wb = XLSX.utils.book_new()
const add = (name, rows, widths) => {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 说明: '暂无数据' }])
  if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, name)
}
const sheetOf = (headers, rows) => rows.map((r) => Object.fromEntries(headers.map((h) => [h, r[h] ?? ''])))

add('概览', overview.map(([指标, 值, 口径]) => ({ 指标, 值: String(值), 口径 })), [18, 12, 62])
add('网关台账', gateways, [14, 16, 12, 16, 8, 12, 8, 20, 8, 40])
add('设备台账', devices, [14, 14, 10, 16, 16, 14, 16, 14, 8, 14, 14, 10, 20, 10, 8, 20, 8, 8, 8, 10])
add('采集点', points, [14, 14, 14, 14, 10, 8, 12, 10, 10, 10, 8, 8])
add('数采规则', rules, [14, 14, 22, 14, 20, 40, 8])
add('采集流水', sheetOf(['流水ID', '设备编码', '设备名称', '采集点编码', '采集点名称', '数值', '文本值', '质量码', '采集时间'], samples),
  [10, 14, 14, 14, 14, 14, 24, 8, 20])
add('报警记录', alarms, [10, 14, 14, 14, 14, 8, 52, 12, 20, 10, 10, 20, 30])
add('在线状态日志', statusLogs, [10, 14, 14, 8, 20, 40])
add('数据说明', [
  { 项: '导出内容', 内容: '数采平台(设备数据采集):网关台账 / 设备台账 / 采集点 / 数采规则 / 采集流水 / 报警记录 / 在线状态日志' },
  { 项: '数据源', 内容: `${DB}.dbo.bs_dc_gateway / device / point / rule / sample / alarm / status_log` },
  { 项: '🔴 密钥', 内容: '网关接入密钥 api_key **未导出**(公开仓库;硬件上报靠 X-DC-Key 校验,密钥一泄露谁都能伪造上报)。表里只有「密钥已设置 = 是/否」。' },
  { 项: '设备地址', 内容: '设备 IP(192.168.x.x 内网)与序列号按原样保留 —— 台账就是给人看怎么配的。含内网设备地址,请勿对外再分发。' },
  { 项: '数据真实性', 内容: '没有硬件上报就没有流水/报警。本表不含任何编造的演示数字;当前设备多为"测试电子秤/测试网关",见各表备注列。' },
  { 项: '导出时间', 内容: new Date().toISOString().replace('T', ' ').slice(0, 19) },
  { 项: '导出脚本', 内容: 'tools/archive/_dc-export-20261018/_export-dc-xlsx.mjs' },
], [16, 108])

mkdirSync(OUTDIR, { recursive: true })
const outFile = path.join(OUTDIR, '数采平台数据-' + STAMP + '.xlsx')
XLSX.writeFile(wb, outFile)
console.log('已写出: ' + outFile)

/* ── 自检 ── */
const fails = []
const wb2 = XLSX.readFile(outFile)
const wantSheets = ['概览', '网关台账', '设备台账', '采集点', '数采规则', '采集流水', '报警记录', '在线状态日志', '数据说明']
if (wb2.SheetNames.join(',') !== wantSheets.join(',')) fails.push('页签不符: ' + wb2.SheetNames.join(','))
const rowsOf = (n) => XLSX.utils.sheet_to_json(wb2.Sheets[n], { header: 1, defval: '' })
const expect = { 网关台账: gateways.length, 设备台账: devices.length, 采集点: points.length, 数采规则: rules.length, 采集流水: samples.length, 报警记录: alarms.length, 在线状态日志: statusLogs.length }
for (const [n, want] of Object.entries(expect)) {
  const got = rowsOf(n).length - 1
  if (want === 0 ? got !== 1 : got !== want) fails.push(`${n} 行数不符: 表=${got} 库=${want}`)
}
// 关键:全表扫描,确认没有任何单元格含有真实的 api_key 值
const realKeys = (await (async () => {
  const p3 = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
    password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true, loginTimeout: 10 } })
  const r = await p3.request().query(`SELECT api_key FROM bs_dc_gateway WHERE ISNULL(api_key,'')<>''`)
  await p3.close()
  return r.recordset.map((x) => String(x.api_key))
})())
let leaked = 0
for (const n of wb2.SheetNames) {
  const txt = JSON.stringify(XLSX.utils.sheet_to_json(wb2.Sheets[n], { header: 1, defval: '' }))
  for (const k of realKeys) if (k && txt.includes(k)) leaked++
}
if (leaked > 0) fails.push(`api_key 泄露 ${leaked} 处`)

const summary = {
  generatedAt: new Date().toISOString(),
  database: DB,
  counts: { gateways: gateways.length, devices: devices.length, points: points.length, rules: rules.length, samples: samples.length, alarms: alarms.length, statusLogs: statusLogs.length },
  apiKeysChecked: realKeys.length,
  apiKeyLeak: leaked,
  sheets: wb2.SheetNames,
  file: path.basename(outFile),
  failed: fails,
}
writeFileSync(path.join(OUTDIR, '_export-summary.json'), JSON.stringify(summary, null, 2), 'utf8')

if (fails.length) {
  fails.forEach((f) => console.log('[FAIL] ' + f))
  process.exit(1)
}
console.log(`[OK] 自检通过: 9 个页签;行数与库一致;api_key 扫描 ${realKeys.length} 个密钥、泄露 ${leaked} 处`)
