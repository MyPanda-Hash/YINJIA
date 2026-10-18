/**
 * _v-gate.mjs — 库存台账/收发存汇总「查询弹窗门 + 查询口径」回归(后端 + 纯函数,不经浏览器)
 *
 * 背景(2026-10-20 用户报障「库存台账和收发存汇总表出现重复弹窗和查询问题」):
 *   沙箱里 Edge/CDP 与 esbuild 都起不来(spawn EPERM),界面层用 _check-sfc.mjs 静态核,
 *   行为层由本脚本钉住:
 *   ① 面板配置仍是 reportQueryDialog=true、查询字段就是 仓库/存货(参照 WH/INV)
 *   ② 弹窗产出的 condition 口径:带 `_whCode/_itemCode` 时**按编码精确收窄、不串仓串存货**;
 *      ⚠ 台账有一条**既定口径**:按「仓库+存货+日期段」查询时恒带**期初/期末两条合成行**
 *      (migrate-stock-ledger-open-close.sql,T+ 同款:首行期初=期前累计、末行期末=期末结存)。
 *      故明细收窄只能看**非合成行**;日期段生效的判据是「2099 空区间 ⇒ 明细 0 行、只剩两条合成行」。
 *   ③ 纯函数 shouldAutoOpenReportQuery / validateReportQuery / cleanCondition 的口径
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_v-gate.mjs [http://127.0.0.1:8090]
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanCondition,
  defaultReportRange,
  shouldAutoOpenReportQuery,
  validateReportQuery,
} from '../../../frontend/src/core/report/reportQuery.js'

const OUT = dirname(fileURLToPath(import.meta.url))
const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const lines = []
let fails = 0
const ok = (name, cond, detail = '') => {
  const s = `${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`
  console.log(s); lines.push(s)
  if (!cond) fails++
}

// ── ③ 纯函数口径(与 frontend/src/core/report/reportQuery.test.js 同一组断言) ──
const gate = (o) => shouldAutoOpenReportQuery({ enabled: true, panelCode: 'STOCK_LEDGER', hasApplied: false, dialogVisible: false, ...o })
ok('首次进入弹一次', gate({}) === true)
ok('弹窗正开着时后台 load 不再弹(重复弹窗防线)', gate({ dialogVisible: true }) === false)
ok('已查过一次后不再弹', gate({ hasApplied: true }) === false)
ok('离开面板不弹', gate({ panelCode: 'undefined' }) === false)
ok('台账必填仓+存货', validateReportQuery({ panelCode: 'STOCK_LEDGER', range: ['2026-10-01', '2026-10-20'], wh: '正品仓', item: '' }).ok === false)
ok('汇总只要日期', validateReportQuery({ panelCode: 'STOCK_SUMMARY', range: ['2026-10-01', '2026-10-20'], wh: '', item: '' }).ok === true)
ok('默认区间=本月初→今天', defaultReportRange(new Date(2026, 9, 20)).join('~') === '2026-10-01~2026-10-20')
const kept = cleanCondition({ 仓库: '正品仓', _whCode: 'CK00001', 存货: '端盖', _itemCode: 'A-1', 开始日期: '2026-10-01', 空: '' })
ok('cleanCondition 保留 `_` 控制键', kept._whCode === 'CK00001' && kept._itemCode === 'A-1' && !('空' in kept))

// ── ① 面板配置 ──
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
ok('登录正式账套', !!token)
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' }
const query = async (body) => {
  const r = await (await fetch(host + '/api/px/queryFormDataList', {
    method: 'POST', headers: H, body: JSON.stringify(body),
  })).json()
  if (!r?.data) throw new Error(JSON.stringify(r).slice(0, 200))
  return r.data
}
/**
 * 台账「合成行」的判据 = **没有仓库编码/存货编码**。
 * 不能只看 `单据类型` —— 台账里还有**真实流水行**的单据类型就叫「期初结存」
 * (金蝶期初导入的 migration 行,_QGaps.java 实测 id=5 仓=CK00003 日期=1900-01-01 类型=期初结存)。
 * QueryService#ledgerRow 造的两条合成行只有 单据类型 + 期初/期末三列,编码列是空的。
 */
const isSynth = (r) => !String(r['仓库编码'] || '').trim() && !String(r['存货编码'] || '').trim()
const detailRows = (rows) => rows.filter((r) => !isSynth(r))
const synthRows = (rows) => rows.filter((r) => isSynth(r))

for (const code of ['STOCK_LEDGER', 'STOCK_SUMMARY']) {
  const cfg = await (await fetch(`${host}/api/px/getPanelConfig?panelCode=${code}`, { headers: H })).json()
  const md = cfg?.data?.metadata || {}
  const tp = md.panelPageDto?.tablePages?.[0] || {}
  const qf = (tp.queryFields || []).map((f) => `${f.dataName}${f.dataType === '参照' ? '→' + f.refPanel : ''}`)
  ok(`${code} 仍走进入即弹查询弹窗`, md.reportQueryDialog === true)
  ok(`${code} 查询字段=仓库/存货(参照)`, qf.join(',') === '仓库→WH,存货→INV', qf.join(','))

  // 样本:必须先有一个**真有流水明细**的 (仓库,存货) —— 台账第一页多是期初合成行,
  // 用它们当样本的话"明细 0 行"根本分不清是收窄对了还是查询坏了。
  // 取法:从台账流水里挑一个明细行最多的组合(实证见 _QDetail.java 输出),按**关键词**定位它的编码/名称。
  const probe = { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 50, keyword: 'A-48-19' }
  const probeRows = (await query(probe)).list.filter((r) => r['存货编码'] === 'A-48-19' && r['仓库编码'] === 'CP-02')
  const sampleRow = probeRows[0]
  const whCode = sampleRow?.['仓库编码'] || 'CP-02'
  const itemCode = sampleRow?.['存货编码'] || 'A-48-19'
  const whName = sampleRow?.['仓库'] || '成品B仓'
  const itemName = sampleRow?.['存货'] || 'PP复合阻垢炭棒/滤芯'
  const cond = cleanCondition({
    仓库: whName, 存货: itemName, _whCode: whCode, _itemCode: itemCode,
    开始日期: '1900-01-01', 结束日期: '2099-12-31',
  })
  const hit = await query({ panelCode: code, pageNo: 1, pageSize: 200, condition: cond })
  const det = detailRows(hit.list)
  const offWh = det.filter((r) => r['仓库编码'] !== whCode).length
  const offItem = det.filter((r) => r['存货编码'] !== itemCode).length
  ok(`${code} 按编码精确收窄(明细不串仓/不串存货)`, offWh === 0 && offItem === 0 && det.length > 0,
    `样本=${whName}(${whCode})/${itemName}(${itemCode}) 合计=${hit.totalSize} 明细=${det.length} 合成=${synthRows(hit.list).length} 越界=${offWh}/${offItem}`)

  // 名称位放名称(不再夹编码):台账这一路以前恒 0 行明细(名称被当编码比)。
  // 修好后它**会命中同名的其它存货编码**(台账名称列 = 档案存货名,同仓同名实测 12 个码,
  // 见 _QNameCollide.java)—— 这是"名称口径"的既定代价:结果必须 ⊆ 该名称的全部码,且**不得为空**;
  // 弹窗走的是编码(上一项),单码单一性靠它。
  //
  // ⚠ 比的是 **totalSize**(全量命中数)而不是首页明细行数:两个查询都被 flatPageCap 夹到
  //   pageSize=50(报表三张的服务端硬上限),首页明细数只是"截断后还剩几行",拿来比大小没有意义。
  const byNameOnly = await query({ panelCode: code, pageNo: 1, pageSize: 200,
    condition: cleanCondition({ 仓库: whName, 存货: itemName, 开始日期: '1900-01-01', 结束日期: '2099-12-31' }) })
  const dn = detailRows(byNameOnly.list)
  const nameOk = byNameOnly.totalSize >= hit.totalSize && dn.length > 0
  ok(`${code} 只送名称也能查出明细(名称口径:按名称精确等值,不串仓)`, nameOk,
    `只送名称 totalSize=${byNameOnly.totalSize} 首页明细=${dn.length}(含同名异码) vs 带编码 totalSize=${hit.totalSize} 首页明细=${det.length}`)

  // 日期段:2099 年没有任何流水 ⇒ 明细必须 0 行(台账只剩期初/期末两条合成行)
  const empty = await query({ panelCode: code, pageNo: 1, pageSize: 200,
    condition: { ...cond, 开始日期: '2099-01-01', 结束日期: '2099-12-31' } })
  const emptyDet = detailRows(empty.list)
  ok(`${code} 日期段生效(2099 空区间 ⇒ 明细 0 行)`, emptyDet.length === 0,
    `合计=${empty.totalSize} 明细=${emptyDet.length} 合成=${synthRows(empty.list).length}`)
  if (code === 'STOCK_LEDGER') {
    // 台账既定口径:区间内无流水时仍给期初+期末两条合成行(T+ 同款;没有它们用户看不到"这段期间没有发生")
    ok('台账空区间仍带期初/期末两合成行', synthRows(empty.list).length === 2,
      `合成行=${synthRows(empty.list).map((r) => r['单据类型']).join('/')}`)
  }
}

const out = join(OUT, 'v-gate.out')
writeFileSync(out, lines.join('\n') + '\n')
console.log(`\n${fails ? '[FAIL]' : '[PASS]'} ${lines.length} 项,失败 ${fails} 项 · 输出已写 ${out}`)
process.exit(fails ? 1 : 0)
