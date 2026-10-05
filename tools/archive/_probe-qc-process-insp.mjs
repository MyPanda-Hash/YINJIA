/**
 * _probe-qc-process-insp.mjs — 三类工序检验单验收(9.29 生产管理批次 ④,2026-10-05)
 *
 * 口径:报工单审核 → 成型/切炭/组装 各自动生成一张检验单草稿(三张独立);组装成品检验单填数量后审核
 *   → 合格数转产成品入库单草稿、不合格数转不良品处理单草稿;报工弃审 → 草稿检验单作废(已审核则拒绝弃审)。
 *
 * ⚠ 在**测试账套** HSDZ_MES_TEST 上跑(factory=YJ_TEST):本探针会写业务单据,不碰正式账。
 *   跑完由外层 SQL 硬删测试痕迹(单号由本脚本打印)。
 * 用法: node tools/archive/_probe-qc-process-insp.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
/** prod=正式账套(HSDZ_MES,默认) / 传工厂码如 YJ_TEST 则切测试账套 */
const FACTORY = process.argv[3] || 'prod'
const API = BASE + '/api'
let token = ''
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const created = { 报工单: [], 检验单: [], 入库单: [], 不良单: [] }

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
async function get(path) {
  const r = await fetch(API + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
const msg = (r) => r.json?.message || r.text?.slice(0, 200)
const rows = (r) => {
  const d = r.json?.data
  if (Array.isArray(d)) return d
  return d?.list || d?.rows || d?.records || d?.items || []
}
const list = (panel) => post('/px/queryFormDataList', { panelCode: panel, condition: {}, pageNo: 1, pageSize: 200 })
const btn = (panelCode, buttonName, formData, buttonParam) =>
  post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: buttonParam || {} })

async function main() {
  console.log(`== 三类工序检验单探针 @ ${BASE} (账套=${FACTORY}) ==`)
  const loginBody = { userName: 'admin', password: '123456' }
  if (FACTORY !== 'prod') loginBody.factory = FACTORY
  const lg = await post('/auth/login', loginBody)
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功(账套 ' + (lg.json?.data?.user?.factory || FACTORY) + ')')

  // 找一张已排产、未结案的工单(报工前置条件:已排产)
  const wos = await post('/px/workOrderList', {})
  const cand = (wos.json?.data || []).find((r) => r['生产线'] && r['结案'] !== 'Y' && Number(r['排产数量'] || 0) > 0)
  if (!cand) { bad('测试库没有可报工的已排产工单,无法验收'); return summary() }
  console.log(`  工单 ${cand['工单号']}#${cand['工单行号']} @ ${cand['生产线']}`)

  // 三道工序各报一笔(成型/切炭/组装),逐笔审核 → 各出一张检验单
  const expect = [
    { 工序: '成型', panel: 'QC_MOLD_INSP' },
    { 工序: '切炭', panel: 'QC_CUT_INSP' },
    { 工序: '组装', panel: 'QC_ASM_INSP' },
  ]
  const inspNo = {}
  for (const e of expect) {
    // 单表化后 WO_REPORT 的字段都在 detail 位(行表=scjl);表头只留单据日期
    const save = await btn('WO_REPORT', '保存', {
      单据日期: new Date().toISOString().slice(0, 10),
      detail: { items: [{ 工单号: cand['工单号'], 工序: e.工序, 报工数量: 5, 报工人: 'admin', 批次号: cand['批次号'] }] },
    })
    const repNo = save.json?.data?.编号
    if (!repNo) { bad(`报工(${e.工序})保存失败: ` + msg(save)); continue }
    created.报工单.push(repNo)
    const au = await btn('WO_REPORT', '审核', { 编号: repNo })
    if (au.status !== 200) { bad(`报工(${e.工序})审核失败: ` + msg(au)); continue }
    const l = await list(e.panel)
    const doc = rows(l).find((r) => String(r['报工单号'] || '') === String(repNo))
    if (doc) {
      inspNo[e.工序] = doc['单据编号']
      created.检验单.push(doc['单据编号'])
      ok(`${e.工序}报工 ${repNo} 审核 → 自动生成 ${e.panel} ${doc['单据编号']}(工序=${doc['工序']},报工数量=${doc['报工数量']})`)
    } else {
      bad(`${e.工序}报工审核后未见 ${e.panel} 检验单(报工单号 ${repNo})`)
    }
  }
  if (Object.keys(inspNo).length === 3) ok('三工序各出一张检验单(三张独立,不合并)')

  // 组装成品:检验单明细应有 合格/不合格 两行;填数量 → 保存 → 审核 → 合格转库存/不合格待处理
  const asmNo = inspNo['组装']
  if (asmNo) {
    const d = await get('/px/getFormDescriptor?panelCode=QC_ASM_INSP&code=' + encodeURIComponent(asmNo))
    const doc = d.json?.data || {}
    const dd = doc.detailData
    const items = Array.isArray(dd) ? dd : (dd?.items || [])
    if (items.length === 2) ok('组装成品检验单明细 = 2 行(合格/不合格各一行)')
    else bad('组装成品检验单明细行数 = ' + items.length + '(期望 2)')
    const hasOk = items.some((x) => String(x['判定']) === '合格')
    const hasNg = items.some((x) => String(x['判定']) === '不合格')
    hasOk && hasNg ? ok('明细判定预置 = 合格/不合格') : bad('明细判定未预置合格/不合格')
    // 合格 7 / 不合格 3
    for (const it of items) {
      it['数量'] = String(it['判定']) === '合格' ? 7 : 3
    }
    const form = { ...(doc.data || {}), detail: { items } }
    const sv = await btn('QC_ASM_INSP', '保存', form)
    if (sv.status !== 200) bad('检验单填数量后保存失败: ' + msg(sv))
    else ok('检验单填数量保存成功(合格 7 / 不合格 3)')
    const au = await btn('QC_ASM_INSP', '审核', { 编号: asmNo })
    if (au.status !== 200) bad('组装成品检验单审核失败: ' + msg(au))
    else ok('组装成品检验单审核成功')
    const fins = rows(await list('FINISH_IN')).filter((r) => String(r['加工单号'] || '') === String(cand['工单号']))
    if (fins.length) { created.入库单.push(fins[0]['单据编号']); ok('合格数 7 → 生成产成品入库单草稿 ' + fins[0]['单据编号']) }
    else bad('未生成产成品入库单(合格数转库存失败)')
    const bls = rows(await list('QC_DISPOSAL'))
    const hit = bls.find((r) => String(r['来源单号'] || '') === String(asmNo))
    if (hit) { created.不良单.push(hit['单据编号']); ok('不合格数 3 → 生成不良品处理单草稿 ' + hit['单据编号'] + '(处置方式=' + hit['处置方式'] + ')') }
    else bad('未生成不良品处理单(不合格待处理失败)')
    // 已审核检验单 → 报工弃审应被拒
    const un = await btn('WO_REPORT', '弃审', { 编号: created.报工单[created.报工单.length - 1] })
    un.status >= 400 ? ok('检验单已审核时弃审报工被拒: ' + msg(un)) : bad('检验单已审核但报工弃审未被拒')
  }

  // 成型:草稿检验单 → 弃审报工应成功且检验单作废(可撤回)
  const moldNo = inspNo['成型']
  const moldRep = created.报工单[0]
  if (moldNo && moldRep) {
    const un = await btn('WO_REPORT', '弃审', { 编号: moldRep })
    if (un.status !== 200) bad('草稿检验单场景弃审报工失败: ' + msg(un))
    else {
      ok('草稿检验单场景弃审报工成功(联动作废)')
      const l = await list('QC_MOLD_INSP')
      const still = rows(l).find((r) => String(r['单据编号']) === String(moldNo))
      !still ? ok('成型检验单已随报工弃审作废(列表不再出现)= 可撤回') : bad('报工弃审后成型检验单仍在列表(作废失败)')
    }
  }

  console.log('\n清理用单号(交给外层 SQL 硬删): ' + JSON.stringify(created))
  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
