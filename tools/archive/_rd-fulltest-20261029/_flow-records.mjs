/**
 * _flow-records.mjs —— 阶段7:数据记录表 + 实验室使用记录表(12 张)
 * 用法: node _flow-records.mjs [base]
 *
 * 必填项口径来自 yj_field 实测(2026-10-29):
 *   7 张数据记录表(碱性/矿化/抑菌/阻垢/RO保护/浸泡/压降/滤效):文档编号 + 测试主题
 *   加标水:测试项目
 *   仪器使用:仪器名称/型号
 *   测试申请单:申请单类型
 *   设备使用:已通过(用它做对照)
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const results = []
const log = (k, v) => { out.push({ step: k, result: v }); console.log('\n── ' + k + ' ──'); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }

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
async function call(panel, buttonName, formData, buttonParam = {}) {
  return await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam }),
  })).json()
}

const THEME = '高效除重金属炭棒滤芯 YKRS-200 性能验证'
/** 7 张走"文档编号+测试主题"的记录表 */
const REC7 = [
  ['RD_ALKALINE', 'rd_alkaline', '碱性', '测试数据', [{ 项目: 'PH', 实测值: '7.2' }, { 项目: '碱度', 实测值: '35' }]],
  ['RD_MINERAL', 'rd_mineral', '矿化', '数据记录表', [{ 项目: 'TDS', 实测值: '85' }, { 项目: '钙', 实测值: '12' }]],
  ['RD_ANTIBACT', 'rd_antibact', '抑菌', '数据记录表', [{ 项目: '大肠杆菌', 实测值: '>99.9%' }]],
  ['RD_SCALE', 'rd_scale', '阻垢性能', '测试数据', Array.from({ length: 11 }, (_, i) => ({ 项目: 'T' + (i + 1), 实测值: String(100 + i) }))],
  ['RD_RO_PROTECT', 'rd_ro_protect', 'RO保护', '数据记录表', [{ 项目: '余氯', 实测值: '0.05' }]],
  ['RD_SOAK', 'rd_soak', '浸泡安全', '数据记录表', [{ 项目: '浑浊度', 实测值: '0.15' }]],
  ['RD_DROP_PREC', 'rd_drop_prec', '压降精度', '数据记录表', [{ 前压: '0.21', 后压: '0.19', 压差: '0.02', 测试水温: '25', 测试流速: '2' }]],
  ['RD_FILTER_EFF', 'rd_filter_eff', '功能性滤效', '数据记录表', [{ 项目: '除铅率', 实测值: '98.5' }]],
]

const CASES = []
for (const [panel, table, name, area, rows] of REC7) {
  CASES.push({
    panel, table, name,
    head: { 文档编号: 'YJ-QR-' + panel.replace('RD_', '').slice(0, 4), 测试主题: THEME },
    dt: rows.map((r, i) => ({ 表区: area, 序号: String(i + 1), 测试负责人: '系统管理员', 密级: '保密', ...r })),
  })
}
CASES.push({ panel: 'RD_SPIKE_WATER', table: 'rd_spike_water', name: '加标水',
  head: { 测试项目: '铅加标回收率', 文档编号: 'YJ-QR-SW', 测试主题: THEME },
  dt: [{ 序号: '1', 项目: '加标浓度', 实测值: '150ppb' }] })
CASES.push({ panel: 'RD_EQUIP_USE', table: 'rd_equip_use', name: '设备使用',
  head: { 设备名称: '压降测试台', 设备编号: 'EQ-DP-01' },
  dt: [{ 序号: '1', 使用日期: '2026-10-29', 使用时段: '09:00-11:00', 使用人: '系统管理员', 用途: '压降性能验证' }] })
CASES.push({ panel: 'RD_INSTR_USE', table: 'rd_instr_use', name: '仪器使用',
  head: { '仪器名称/型号': 'ICP-MS / Agilent 7900', 仪器编号: 'INS-ICP-01' },
  dt: [{ 序号: '1', 使用日期: '2026-10-29', 使用时段: '14:00-16:00', 使用人: '系统管理员', 用途: '重金属析出检测' }] })
CASES.push({ panel: 'RD_DOM_TEST', table: 'rd_dom_test', name: '测试申请单',
  head: { 申请单类型: '内部委托', 测试主题: THEME },
  dt: [{ 表区: '内部委托', 序号: '1', 日期: '2026-10-29', 申请人: '系统管理员', 项目: '除铅率', 测试方法: 'ICP-MS' }] })

for (const c of CASES) {
  const mk = await call(c.panel, '新增', {})
  const no = String(mk?.data?.['编号'] || '')
  if (!no) { results.push({ panel: c.panel, name: c.name, step: '新建', 结果: 'FAIL:' + mk.message }); console.log(`FAIL ${c.panel.padEnd(16)} 新建失败: ${mk.message}`); continue }

  const sv = await call(c.panel, '保存', { 编号: no, 单据日期: '2026-10-29', ...c.head, detail: { items: c.dt } })
  const saved = sv.code === 200
  let state = ''
  if (saved) {
    let apv = await call(c.panel, '审批通过', { 编号: no, 二级审批人: 'admin', 审批意见: '验收通过' })
    if (apv.code === 200 && /待二级/.test(String(apv?.data?.['单据状态']))) {
      apv = await call(c.panel, '审批通过', { 编号: no, 审批意见: '二级通过' })
    }
    state = String(apv?.data?.['单据状态'] || (apv.code === 200 ? 'OK' : 'FAIL:' + apv.message))
  }
  let nDetail = '?'
  try {
    const r = q(`SELECT COUNT(*) AS n FROM ${c.table}_detail WHERE 单据编号='${no}'`)
    nDetail = (r.match(/^\d+$/m) || ['?'])[0]
  } catch { nDetail = '表名?' }

  const pass = saved && /已归档|已审核/.test(state)
  results.push({ panel: c.panel, name: c.name, no, 保存: saved ? 'OK' : sv.message, 归档: state, 明细行: nDetail, 通过: pass })
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${c.panel.padEnd(16)} ${c.name.padEnd(10)} ${no.padEnd(20)} 保存=${saved ? 'OK' : String(sv.message).slice(0, 24)} 归档=${state} 明细=${nDetail}`)
}

const passN = results.filter((r) => r.通过).length
log('汇总', results)
console.log(`\n════ 阶段7: ${passN}/${results.length} 通过 ════`)
const bad = results.filter((r) => !r.通过)
if (bad.length) console.log('未通过明细:\n' + JSON.stringify(bad, null, 1).slice(0, 1200))

await fs.writeFile(new URL('./out-flow-records.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
