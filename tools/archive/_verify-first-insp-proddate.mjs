/*
 * _verify-first-insp-proddate.mjs — 首件检验单「完工回填生产日期/批号」端到端验收(2026-10-16 第二轮)
 *
 * 【用户口径】「让生产日期在当前根据当前的生产工单完成首批次后进行回填到当前的实现,生产的环节是有工单号,
 *   检验单是绑定工单号的,这个工单生产啥样的批号,检验人员是不知道的,追溯的时候,由批号找到工单,
 *   再由工单找到检验单的,批次号是完工时自动生产的就这样实现吧。」
 *
 * 【验什么】三条工单行各走一遍(都在**测试账套** HSDZ_MES_TEST):
 *   ① 出单**不再写死今天**:第一张报工审核自动出首件检验单时,本行还没完工 ⇒ 生产日期是**空的**
 *      (完工日还不知道,不该先填一个假的);检验单绑的是 工单号 + 工单行号;
 *   ② 完工回填:末道报工审核 ⇒ 本行 完工状态=生产完工,并把 生产日期(=该行**完工当日**)+ 批号
 *      回填到那张首件检验单上;
 *      ⚠ 完工程序里先把 `plang.完工时间` 放一个**哨兵日期 2026-08-08**(完工那次 syncOneRowState
 *        对非空完工时间只保留不改),检验单上回填出来的若是 2026-08-08 而不是今天,就证明这一格
 *        取的是**工单完工日**、不是出单日/今天;
 *   ③ 只填空格:第二条工单行的检验单在完工前被"人工填了生产日期、批号空着" ⇒ 完工回填**不覆盖**人工
 *      日期,但把空着的批号补上;
 *   ④ 出单即完工分支:第三条工单行临时把路线的**前道工序作废**(只留末道)⇒ 首张报工即末道,
 *      「出单」与「完工」发生在同一笔事务里 ⇒ 这一张在出单那一刻本行已完工,生产日期当场按完工日填上
 *      (否则它会一直空着,要等下**一次**完工事件);验完把路线原样还原;
 *   ⑤ 追溯链:批号 → 工单(plang.批次号) → 首件检验单(工单号+工单行号) 走得通。
 *
 * ⚠ 全程只动**测试账套**:造的业务单据跑完硬删,临时改过的演示工单行/路线定义原样还原。不碰正式账。
 * 用法: node tools/archive/_verify-first-insp-proddate.mjs [base]
 */
import { createRequire } from 'node:module'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const API = BASE + '/api'
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
/** 完工时间哨兵:完工回填若真取"工单完工日",检验单上出现的应是这一天(而不是今天) */
const SENTINEL = '2026-08-08 09:00:00'
const SENTINEL_DAY = '2026-08-08'
let token = ''
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const made = { 报工单: [], 首件检验单: [], 还原: [], 路线还原: [] }

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset
const esc = (v) => (v === null || v === undefined ? 'NULL' : `N'${String(v).replace(/'/g, "''")}'`)
const day = (d) => (d ? new Date(d).toLocaleDateString('sv-SE') : '')
const todayDash = day(new Date())

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
const msg = (r) => r.json?.message || r.text?.slice(0, 200)
const btn = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {} })
const list = (panel) => post('/px/queryFormDataList', { panelCode: panel, condition: {}, pageNo: 1, pageSize: 500 })
const rowsOf = (r) => {
  const d = r.json?.data
  if (Array.isArray(d)) return d
  return d?.list || d?.rows || d?.records || d?.items || []
}
/** 报工:保存 + 审核。批次号是保存时**行锚点**的一部分(stampRowNo 按 工单号+批次号 恰命中 1 行才落
 *  工单行号),故必须带上本行的批号。 */
async function report(wo, batch, op, qty) {
  const s = await btn('WO_REPORT', '保存', {
    单据日期: todayDash,
    detail: { items: [{ 工单号: wo, 工序: op, 报工数量: qty, 报工人: 'admin', 批次号: batch }] },
  })
  const no = s.json?.data?.编号
  if (!no) return { no: null, save: s, audit: null }
  made.报工单.push(no)
  const au = await btn('WO_REPORT', '审核', { 编号: no })
  return { no, save: s, audit: au }
}
const sheetOfReport = async (repNo) => {
  const l = await list('QC_FIRST_INSP')
  return rowsOf(l).find((r) => String(r['报工单号'] || '') === String(repNo))
}
const headOf = async (no) => (await q(`SELECT ISNULL(批次号,'') AS 批次号, ISNULL(生产日期,'') AS 生产日期,
  ISNULL(客户代码,'') AS 客户代码, ISNULL(客户名称,'') AS 客户名称
  FROM dbo.qc_first_insp_head WHERE 单据编号=${esc(no)}`))[0] || {}
const plangOf = async (id) => (await q(`SELECT ISNULL([批次号],'') AS 批次号, ISNULL(完工状态,'') AS 完工状态,
  CONVERT(varchar(19), 完工时间, 120) AS 完工时间 FROM dbo.plang WHERE id=${id}`))[0] || {}
const rateOf = async (route, op) => Number((await q(`SELECT TOP 1 ISNULL(换算率,1) AS rate FROM dbo.bs_route
  WHERE 工艺路线编码=${esc(route)} AND 工序名称=${esc(op)} AND ISNULL(asp_cancel,'N')<>'Y'`))[0]?.rate || 1)

const lg = await post('/auth/login', { userName: 'admin', password: '123456', factory: FACTORY })
token = lg.json?.data?.token
if (!token) { console.error('登录失败: ' + msg(lg)); process.exit(1) }
console.log(`== 首件检验单「完工回填生产日期/批号」验收 @ ${BASE} (账套 ${DB},今天 ${todayDash}) ==`)

/** ① ② ③ ⑤:正常多工序路线走完整链;manualDate 非空 = 完工前模拟"品质手填了生产日期且批号空着" */
async function runFlow(cand, manualDate) {
  const tag = manualDate ? `${cand.工单号}(人工填过 ${manualDate})` : `${cand.工单号}(空着等回填)`
  console.log(`\n── ${tag} 行 ${cand.行} 路线 ${cand.路线} 计划 ${cand.计划量} 工序 ${cand.工序.join('→')} ──`)
  // ① 首道:少量报工 → 审核 ⇒ 自动出单,生产日期应为空
  const r1 = await report(cand.工单号, cand.原批号, cand.工序[0], Math.max(1, Math.round(cand.计划量 * 0.05)))
  ok(`① ${tag} 首道(${cand.工序[0]})报工审核`, r1.audit?.status === 200, r1.no + ' ' + msg(r1.audit || r1.save))
  const doc = await sheetOfReport(r1.no)
  ok(`① ${tag} 自动出首件检验单`, !!doc, JSON.stringify(doc || {}).slice(0, 160))
  if (!doc) return null
  const sheet1 = doc['单据编号']
  made.首件检验单.push(sheet1)
  await sleep(150)
  ok(`① ${tag} 出单时生产日期为空(不再写死今天)`,
    !String(doc['生产日期'] || '').trim(), `生产日期=${JSON.stringify(doc['生产日期'])}`)
  ok(`① ${tag} 检验单绑的是工单号(+工单行号)`,
    String(doc['工单号']) === cand.工单号 && Number(doc['工单行号'] || 0) === cand.行,
    `工单号=${doc['工单号']} 工单行号=${doc['工单行号']}`)
  // 客户代码/客户名称随单带入(2026-10-16 第三轮:纸面相关要求第 6 条「C-95客户相关产品…」的判定依据)
  ok(`① ${tag} 客户代码/客户名称随工单带入`, String(doc['客户代码'] || '') === String(cand.客户代码 || ''),
    `客户代码=${JSON.stringify(doc['客户代码'])} 工单=${JSON.stringify(cand.客户代码)} 客户名称=${JSON.stringify(doc['客户名称'])}`)
  if (manualDate) {
    await q(`UPDATE dbo.qc_first_insp_head SET 生产日期=${esc(manualDate)}, 批次号=N'' WHERE 单据编号=${esc(sheet1)}`)
    console.log(`    (已模拟品质手填:生产日期=${manualDate},批次号清空)`)
  }
  // ② 中间道(报满量)
  for (let i = 1; i < cand.工序.length - 1; i++) {
    const op = cand.工序[i]
    const cap = Math.round(cand.计划量 * (await rateOf(cand.路线, op)) * 100) / 100
    const r = await report(cand.工单号, cand.原批号, op, cap)
    ok(`② ${tag} ${op} 报工审核(量 ${cap})`, r.audit?.status === 200, r.no + ' ' + msg(r.audit || r.save))
  }
  // ③ 末道前把完工时间放哨兵 —— 完工那次 syncOneRowState 对非空完工时间只保留不改
  const lastOp = cand.工序[cand.工序.length - 1]
  await q(`UPDATE dbo.plang SET 完工时间='${SENTINEL}' WHERE id=${cand.id}`)
  const capLast = Math.round(cand.计划量 * (await rateOf(cand.路线, lastOp)) * 100) / 100
  const rl = await report(cand.工单号, cand.原批号, lastOp, capLast)
  ok(`③ ${tag} 末道(${lastOp})报工审核(量 ${capLast})`, rl.audit?.status === 200, rl.no + ' ' + msg(rl.audit || rl.save))

  const p = await plangOf(cand.id)
  ok(`③ ${tag} 工单行进入生产完工`, p.完工状态 === '生产完工', `完工状态=${JSON.stringify(p.完工状态)}`)
  ok(`③ ${tag} 完工日 = 哨兵日(证明这一格取的是工单完工日)`, day(p.完工时间) === SENTINEL_DAY,
    `完工时间=${JSON.stringify(p.完工时间)}`)

  const h = await headOf(sheet1)
  if (manualDate) {
    ok(`③ ${tag} 人工填的生产日期**不被覆盖**`, String(h.生产日期) === manualDate, `生产日期=${JSON.stringify(h.生产日期)}`)
    ok(`③ ${tag} 空着的批号被回填成工单批号`, String(h.批次号) === String(p.批次号) && !!String(p.批次号),
      `检验单批次号=${JSON.stringify(h.批次号)} 工单批号=${JSON.stringify(p.批次号)}`)
  } else {
    ok(`③ ${tag} 生产日期回填 = 工单完工日(${SENTINEL_DAY},不是今天)`,
      String(h.生产日期) === SENTINEL_DAY, `生产日期=${JSON.stringify(h.生产日期)}`)
  }
  const chain = await q(`SELECT TOP 1 h.单据编号 FROM dbo.qc_first_insp_head h JOIN dbo.plang p ON p.id=${cand.id}
      WHERE h.工单号=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y'
        AND (ISNULL(h.工单行号,0)=0 OR ISNULL(h.工单行号,0)=ISNULL(p.pl_xc,0))
        AND ISNULL(h.批次号,'')=ISNULL(p.批次号,'')`)
  ok(`⑤ ${tag} 批号 → 工单 → 检验单 追溯链通`, chain.length > 0 && String(chain[0].单据编号) === sheet1, JSON.stringify(chain))
  return { sheet1 }
}

/** ④ 出单即完工:临时把路线前道作废(只留末道)⇒ 首张报工就是末道报工,同一笔事务里"完工 + 出单" */
async function creationWhileCompleted(cand) {
  const tag = `${cand.工单号}(单工序路线·出单即完工)`
  console.log(`\n── ${tag} 行 ${cand.行} 路线 ${cand.路线}(临时只留末道) ──`)
  const lastOp = cand.工序[cand.工序.length - 1]
  const drop = await q(`SELECT id FROM dbo.bs_route WHERE 工艺路线编码=${esc(cand.路线)}
    AND 工序名称<>${esc(lastOp)} AND ISNULL(asp_cancel,'N')<>'Y'`)
  await q(`UPDATE dbo.bs_route SET asp_cancel='Y' WHERE 工艺路线编码=${esc(cand.路线)}
    AND 工序名称<>${esc(lastOp)} AND ISNULL(asp_cancel,'N')<>'Y'`)
  made.路线还原.push({ route: cand.路线, ids: drop.map((r) => r.id).join(',') })
  // 同批把这条工的客户临时改成 C-95(纸面《相关要求》第 6 条那个客户)⇒ 验出单把客户代码带到检验单,
  //   单上的 C-95 提醒条(QcFirstInspSheet)就以它为判据(界面部分见 _probe-first-insp-reqs.mjs)。
  await q(`UPDATE dbo.plang SET khdm=N'C-95' WHERE id=${cand.id}`)
  const cust = (await q(`SELECT ISNULL(mc,N'') AS mc FROM dbo.dm_kh WHERE dm=N'C-95'`))[0]?.mc || ''
  await q(`UPDATE dbo.plang SET 完工时间='${SENTINEL}' WHERE id=${cand.id}`)
  const cap = Math.round(cand.计划量 * (await rateOf(cand.路线, lastOp)) * 100) / 100
  const r = await report(cand.工单号, cand.原批号, lastOp, cap)
  ok(`④ ${tag} 首张报工即末道(${lastOp},量 ${cap})审核`, r.audit?.status === 200, r.no + ' ' + msg(r.audit || r.save))
  const p = await plangOf(cand.id)
  ok(`④ ${tag} 同一笔事务里本行已生产完工`, p.完工状态 === '生产完工', `完工状态=${JSON.stringify(p.完工状态)}`)
  const doc = await sheetOfReport(r.no)
  ok(`④ ${tag} 出单即完工 ⇒ 当场出首件检验单`, !!doc, JSON.stringify(doc || {}).slice(0, 160))
  if (doc) {
    made.首件检验单.push(doc['单据编号'])
    const h = await headOf(doc['单据编号'])
    ok(`④ ${tag} 出单当场回填生产日期 = 本行完工日 ${day(p.完工时间)}`,
      String(h.生产日期) === day(p.完工时间), `生产日期=${JSON.stringify(h.生产日期)} 完工时间=${JSON.stringify(p.完工时间)}`)
    ok(`④ ${tag} C-95 客户:出单带入 客户代码=C-95 + 客户名称=${cust}`,
      String(h.客户代码) === 'C-95' && (!cust || String(h.客户名称) === cust),
      `客户代码=${JSON.stringify(h.客户代码)} 客户名称=${JSON.stringify(h.客户名称)}`)
  }
}

try {
  // ── 选三条工单行:单行工单(报工锚点唯一)、有路线、已排产、本单还没有已审核报工 ──
  const cands = await q(`SELECT TOP 8 p.id, p.pl_no AS 工单号, ISNULL(p.pl_xc,1) AS 行, ISNULL(p.[工艺路线],'') AS 路线,
      ISNULL(p.scx,'') AS 产线, ISNULL(p.pl_sl,0) AS 计划量, ISNULL(p.[批次号],'') AS 原批号,
      ISNULL(p.khdm,N'') AS 客户代码
    FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') NOT IN ('Y','T')
      AND ISNULL(p.scx,'')<>'' AND ISNULL(p.pl_sl,0)>0 AND ISNULL(p.[工艺路线],'')<>''
      AND ISNULL(p.[批次号],'')<>''      -- 报工保存的行锚点要按(工单号+批次号)恰命中 1 行
      AND (SELECT COUNT(*) FROM dbo.plang x WHERE x.pl_no=p.pl_no AND ISNULL(x.asp_cancel,'N')<>'Y')=1
      AND (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y')=0
      AND (SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.工单号=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y')=0
    ORDER BY p.id DESC`)
  const picked = []
  for (const c of cands) {
    const ops = (await q(`SELECT 工序名称 FROM dbo.bs_route WHERE 工艺路线编码=${esc(c.路线)}
      AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,'')<>'' ORDER BY ISNULL(加工顺序,999)`)).map((r) => r['工序名称'])
    if (ops.length >= 2) picked.push({ ...c, 工序: ops })
    if (picked.length === 3) break
  }
  console.log(`候选工单行 ${cands.length} 条,用于验收 ${picked.length} 条${picked[0] ? ':' + picked.map((p) => p.工单号).join(' / ') : ''}`)
  ok('测试账套里找到 3 条可用工单行', picked.length === 3, `只找到 ${picked.length} 条`)

  // ── 备份 + 清完工态(让"首次进入生产完工"这条链从头走一遍) ──
  for (const c of picked) {
    const p = (await q(`SELECT ISNULL([批次号],'') AS 批次号, 完工状态, 完工时间, ISNULL(当前工序,'') AS 当前工序,
        ISNULL(当前工序完工量,0) AS 当前工序完工量, ISNULL(scx,'') AS scx, ISNULL(ja,'N') AS ja,
        ISNULL(khdm,N'') AS khdm
      FROM dbo.plang WHERE id=${c.id}`))[0]
    const pcs = await q(`SELECT id, ISNULL([批次号],'') AS 批次号 FROM dbo.plang_pc WHERE plang_id=${c.id}`)
    made.还原.push({ id: c.id, plang: p, pcs })
    await q(`UPDATE dbo.plang SET 完工状态=NULL, 完工时间=NULL WHERE id=${c.id}`)
  }

  if (picked[0]) await runFlow(picked[0], null)
  if (picked[1]) await runFlow(picked[1], '2000-01-31')
  if (picked[2]) await creationWhileCompleted(picked[2])
} finally {
  // ── 清场:删本探针造的单据 + 还原演示工单行与路线 ──
  for (const no of made.首件检验单) {
    await q(`DELETE FROM dbo.qc_first_insp_detail WHERE 单据编号=${esc(no)}; DELETE FROM dbo.qc_first_insp_head WHERE 单据编号=${esc(no)}`)
  }
  for (const no of made.报工单) {
    await q(`DELETE FROM dbo.form_flow_link WHERE source_panel_code='WO_REPORT' AND source_form_no=${esc(no)}`)
    await q(`DELETE FROM dbo.scjl WHERE 报工单号=${esc(no)}`)
  }
  for (const r of made.路线还原) {
    await q(`UPDATE dbo.bs_route SET asp_cancel='N' WHERE id IN (${r.ids || '-1'})`)
  }
  for (const b of made.还原) {
    await q(`UPDATE dbo.plang SET 批次号=${esc(b.plang.批次号)},
        完工状态=${b.plang.完工状态 ? esc(b.plang.完工状态) : 'NULL'},
        完工时间=${b.plang.完工时间 ? `'${new Date(b.plang.完工时间).toISOString().slice(0, 19).replace('T', ' ')}'` : 'NULL'},
        当前工序=${esc(b.plang.当前工序)}, 当前工序完工量=${Number(b.plang.当前工序完工量) || 0},
        scx=${esc(b.plang.scx)}, ja=${esc(b.plang.ja)}, khdm=${esc(b.plang.khdm)} WHERE id=${b.id}`)
    for (const pc of b.pcs) await q(`UPDATE dbo.plang_pc SET 批次号=${esc(pc.批次号)} WHERE id=${pc.id}`)
  }
  await q(`DELETE FROM dbo.form_flow_link WHERE target_panel_code='QC_FIRST_INSP'
             AND target_form_no NOT IN (SELECT 单据编号 FROM dbo.qc_first_insp_head)`)
  console.log(`\n清场:删报工单 ${made.报工单.length} 张 / 首件检验单 ${made.首件检验单.length} 张;` +
    `还原工单行 ${made.还原.length} 条、路线 ${made.路线还原.length} 条`)
  await pool.close()
}
console.log(`\n== 首件检验单完工回填:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
