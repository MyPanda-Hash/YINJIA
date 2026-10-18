/**
 * _gen-qc-insp-20261016.mjs — 造一批「来料检验单」，让质检看板不再是假的 100%
 *
 * 用户口径(2026-10-16):「原公司没有上传检验单据，所以这些只能自己写一些，现在 100 的合格率太假了」
 *   → 选定「近 30 天、约 90 张、合格率 ~97%、两个账套都写」。
 *
 * 为什么要造数而不是补导:公司给的导出里 qc_insp 只有 11 张、且只有 1 行明细填了数量(100/100 ⇒ 100%)。
 * 造数**走平台接口**(新增 → 保存)，所以单号来自号池、字段走面板校验、状态与留痕口径与手录完全一致
 * (不是裸写库 —— 裸写会像导库那样绕过应用副作用，见 tools/archive/_kingdee-reimport-20261016/README.md)。
 *
 * ⚠ 有意**不审核**:检验单审核会按既有链路 **自动生成采购入库单草稿**(ButtonService.inspAutoPurchaseIn),
 *   90 张检验单会凭空多出 ~90 张采购入库单草稿，把刚核对好的 PURCHASE_IN 计数搅乱。
 *   看板按明细行统计、不看单据状态，故保持草稿即可达到目的；要审核另跑 `--audit`(自担上述副作用)。
 *
 * 用法(在仓库根或 tools 下均可):
 *   node tools/archive/_gen-qc-insp-data-20261016/_gen-qc-insp-20261016.mjs --db HSDZ_MES            # dry-run，只打印计划
 *   node tools/archive/_gen-qc-insp-data-20261016/_gen-qc-insp-20261016.mjs --db HSDZ_MES --apply  # 真写
 *   --docs 90 --days 30 --rate 0.97 可调；--db HSDZ_MES_TEST 走测试账套(登录带 factory=YJ_TEST)
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const BASE = arg('base', 'http://127.0.0.1:8090')
const DB = arg('db', 'HSDZ_MES')
const DOCS = Number(arg('docs', 90))
const DAYS = Number(arg('days', 30))
const TARGET = Number(arg('rate', 0.97))
const APPLY = argv.includes('--apply')
const AUDIT = argv.includes('--audit')
const FACTORY = DB === 'HSDZ_MES' ? undefined : 'YJ_TEST'

// ── 造数的确定性(同参数重跑得到同一套计划；接口写库仍是新增,不幂等) ──
let seed = 20261016
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pick = (a) => a[Math.floor(rnd() * a.length)]
const round = (v) => Math.round(Number(v) || 0)

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset

// 真实来料检验物料(bs_inv.来料检验='是' —— 公司口径里只有这几类必须检验)
const mats = await q(`SELECT TOP 20 存货编码 AS 物料编码, 存货名称 AS 物料名称, 规格型号, 计量单位, 参考成本 AS 单价
  FROM bs_inv WHERE 来料检验 = N'是' AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 存货编码`)
// 供应商池(取自真实暂收单)
const sups = await q(`SELECT DISTINCT TOP 30 供应商, 供应商代码 FROM sl_recv
  WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(供应商, N'') <> N'' ORDER BY 供应商`)
// 检验员池(真实账号姓名；取不到则用兜底名单)
const users = await q(`SELECT TOP 8 ISNULL(NULLIF(real_name, N''), username) AS n FROM yj_user
  WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(enabled, 1) = 1
    AND ISNULL(real_name, N'') NOT LIKE N'演示%' AND ISNULL(real_name, N'') NOT LIKE N'测试%'
    AND ISNULL(real_name, N'') NOT LIKE N'系统管理员%'`)
// 现有检验明细(校准合格率时一并算进去)
const exist = (await q(`SELECT ISNULL(SUM(ISNULL(送检数量,0)),0) AS sent, ISNULL(SUM(ISNULL(不合格数量,0)),0) AS bad
  FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N') <> 'Y'`))[0]
// 已用单号(避免重复；号池本身不重号,这里只做展示)
const used = new Set((await q(`SELECT 单据编号 FROM qc_insp`)).map((r) => r.单据编号))
await pool.close()

if (!mats.length) { console.error('❌ bs_inv 里没有「来料检验=是」的物料,无从造数'); process.exit(1) }
const SUP = sups.length ? sups : [{ 供应商: '福建鑫恒碳业有限公司', 供应商代码: 'YJ-XH' }]
const WHO = users.length ? users.map((u) => String(u.n)) : ['陈秀丽', '李国栋', '周敏', '黄伟']
const QTY = [500, 800, 1000, 1200, 1500, 2000, 2400, 3000, 3500, 4000, 5000, 6000, 8000, 9000, 10000, 12000]
const today = new Date('2026-10-16T00:00:00')

// ── 计划:把 DOCS 张单铺到最近 DAYS 天(每天 2~4 张),每张 1~3 行明细 ──
const plan = []
for (let i = 0; i < DOCS; i++) {
  const back = Math.floor((i / DOCS) * DAYS)                     // 由早到晚铺开
  const d = new Date(today.getTime() - (DAYS - 1 - back) * 86400000)
  const dateStr = d.toISOString().slice(0, 10)
  const sup = pick(SUP)
  const nLines = 1 + Math.floor(rnd() * 3)                       // 1~3 行
  const lines = []
  for (let k = 0; k < nLines; k++) {
    const m = pick(mats)
    const sent = pick(QTY)
    const price = m.单价 == null ? 0 : Number(m.单价)
    lines.push({ 物料编码: m.物料编码, 物料名称: m.物料名称, 规格型号: m.规格型号 || '', 计量单位: m.计量单位 || '个',
      ...(price > 0 ? { 单价: price } : {}), 送检数量: sent, 合格数量: sent, 不合格数量: 0, 处置方式: '' })
  }
  plan.push({ 单据日期: dateStr, 供应商: sup.供应商, 供应商代码: sup.供应商代码, 检验员: pick(WHO), lines })
}

// ── 不合格分布:约 1/3 的单有零星不良(1%~15%)，其中少数走退货/特采 ──
const totalSent = plan.reduce((a, p) => a + p.lines.reduce((b, l) => b + l.送检数量, 0), 0) + Number(exist.sent || 0)
const targetBad = Math.round(((1 - TARGET) * totalSent) - Number(exist.bad || 0))
const defectIdx = []
for (let i = 0; i < plan.length; i++) if (rnd() < 0.34) defectIdx.push(i)
const RATES = [0.012, 0.018, 0.025, 0.03, 0.045, 0.06, 0.09, 0.15]
const DISPOSAL = ['挑用', '让步接收', '让步接收', '退货', '特采', '降级使用']
let scale = 1
for (let iter = 0; iter < 30; iter++) {
  let bad = 0
  for (const i of defectIdx) {
    const p = plan[i]
    const sent = p.lines[0].送检数量
    const rate = RATES[defectIdx.indexOf(i) % RATES.length]
    const b = Math.max(1, round(sent * rate * scale))
    p.lines[0].不合格数量 = Math.min(b, sent)
    p.lines[0].合格数量 = sent - p.lines[0].不合格数量
    p.lines[0].处置方式 = pick(DISPOSAL)
    bad += p.lines[0].不合格数量
  }
  const rate = bad / totalSent
  if (Math.abs(rate - (1 - TARGET)) <= 0.002) break
  scale *= (1 - TARGET) / Math.max(rate, 1e-9)   // 按差距整体缩放后重算
}
for (const p of plan) {
  const bad = p.lines.reduce((a, l) => a + l.不合格数量, 0)
  p.总结论 = bad > 0 ? '不合格' : '合格'
  p.备注 = bad > 0 ? (p.lines.find((l) => l.不合格数量 > 0)?.处置方式 === '退货' ? '外观/尺寸超标，整批退货并通知供应商整改' : '外观有零星不良，经品质评估后可让步使用')
    : '来料检验合格，同意入库'
}

const sum = (f) => plan.reduce((a, p) => a + p.lines.reduce((b, l) => b + f(l), 0), 0)
const genSent = sum((l) => l.送检数量), genBad = sum((l) => l.不合格数量), genLines = sum(() => 1)
const allSent = genSent + Number(exist.sent || 0), allBad = genBad + Number(exist.bad || 0)
console.log(`=== ${APPLY ? '写库' : 'DRY-RUN'} · ${DB} · 造 ${DOCS} 张检验单 / ${DAYS} 天 ===`)
console.log(`物料池 ${mats.length} 个(来料检验=是) · 供应商 ${SUP.length} 家 · 检验员 ${WHO.join('/')}`)
console.log(`明细行 ${genLines} · 送检合计 ${genSent} · 不合格合计 ${genBad} · 有不良的单 ${defectIdx.length} 张`)
console.log(`含存量后:送检 ${allSent} / 不合格 ${allBad} ⇒ 合格率 ${((1 - allBad / allSent) * 100).toFixed(2)}%`)
console.log('示例:', JSON.stringify(plan.slice(0, 2)))
const bad0 = plan.find((p) => p.总结论 === '不合格')
if (bad0) console.log('不良示例:', JSON.stringify(bad0))

if (!APPLY) { console.log('\n(DRY-RUN，未写任何数据；确认后加 --apply)'); process.exit(0) }

// ── 写库:走接口 新增 → 保存 ──
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', ...(FACTORY ? { factory: FACTORY } : {}) }),
})).json()
if (!login?.data?.token) { console.error('❌ 登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1) }
const token = login.data.token
const btn = (panelCode, buttonName, formData) => fetch(`${BASE}/api/px/callButton`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
}).then((r) => r.json())

const made = [], failed = []
const freeNo = async () => {
  // ⚠ 号池(s_allno)与导库进来的单据**不同步**:新增可能发回一个库里已存在的号
  //   (实测本地 IJ 池停在 IJ-2026-10-001x,而库里已有 IJ-2026-10-0011~0020)⇒ 重取直到拿到空号。
  for (let t = 0; t < 8; t++) {
    const nw = await btn('QC_INSP', '新增', {})
    const no = nw?.data?.编号
    if (!no) return { err: '取号失败:' + JSON.stringify(nw).slice(0, 80) }
    if (!used.has(no)) { used.add(no); return { no } }
  }
  return { err: '连续 8 次取到的号都已被占用(号池未推进?)' }
}
for (const [idx, p] of plan.entries()) {
  const got = await freeNo()
  if (got.err) { failed.push({ idx, why: got.err }); continue }
  const no = got.no
  const fd = {
    // ⚠ 必须带 **编号**:新增建的骨架行是以 `编号` 为身份的;只给 `单据编号` 时保存会**另起一张单**
    //   (实测:90 次新增各留一个空壳头 + 保存各起一个新号 ⇒ 库里多 90 个空壳头,见 cleanup-empty-qc-heads-20261016.sql)
    编号: no, 单据编号: no, 单据日期: p.单据日期, 业务员: 'admin', 供应商: p.供应商, 供应商代码: p.供应商代码,
    检验员: p.检验员, 检验日期: p.单据日期, 检验方案: '正常检验一次抽样(GB/T 2828.1)', 执行标准: 'GB/T 2828.1-2012',
    检验类型: '来料检验', 总结论: p.总结论, 备注: p.备注,
    detail: { items: p.lines.map((l) => ({ ...l, 处置方式: l.处置方式 || undefined })) },
  }
  const sv = await btn('QC_INSP', '保存', fd)
  if (sv?.code !== 200) { failed.push({ 单号: no, why: '保存失败:' + String(sv?.message || '').slice(0, 120) }); continue }
  let state = '草稿'
  if (AUDIT) {
    const a = await btn('QC_INSP', '提交审批', { 编号: no, 单据编号: no })
    const b = await btn('QC_INSP', '审批通过', { 编号: no, 单据编号: no })
    state = b?.code === 200 ? '已审核' : `审批失败:${String(b?.message || '').slice(0, 60)}`
  }
  made.push({ 单号: no, 单据日期: p.单据日期, 总结论: p.总结论, 行: p.lines.length, 状态: state })
  if ((idx + 1) % 10 === 0) console.log(`  …已写入 ${made.length}/${plan.length}`)
}
console.log(`\n=== 完成:成功 ${made.length} 张 / 失败 ${failed.length} 张 ===`)
for (const f of failed.slice(0, 10)) console.log('  [失败]', JSON.stringify(f))
console.log('样例:', JSON.stringify(made.slice(0, 3)))
console.log('不良单:', JSON.stringify(made.filter((m) => m.总结论 === '不合格').slice(0, 3)))
