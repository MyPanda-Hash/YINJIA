/**
 * insp-auto-return-e2e.cjs — 来料检验单审核 → 自动生成暂收退回单(端到端,真实 HTTP)
 *
 * 为什么有它(2026-10-15):ButtonService.inspAutoReturn 用 `不良数量` 过滤不良行,而
 *   ① 「不良数量」是 qc_insp_detail 的旧列 —— 2026-09-20 起面板字段叫「不合格数量」;
 *   ② 该旧列**全库无 yj_field、也没有任何代码写它**,两个账套实测非空值恒 0 行;
 *   numOr(NULL) = 0 ⇒ 过滤恒空 ⇒ 方法直接 return ⇒ 检验单审核**永远不生暂收退回单**,
 *   2026-10-04 定的「检验单→暂收退料单→特采单」整条链第一环就断。
 *
 * 口径(需求真源):
 *   · ButtonService:1399-1402 —— 检验单审核双出口:合格行→采购入库单,不良行→暂收退回单
 *   · ButtonService:3035-3041 —— 退回数量=不合格数量;送检数量随链带走;无不良的行不生成
 *
 * 用法:node tools/verify/insp-auto-return-e2e.cjs [factory]   (默认 YJ_TEST,造数不碰正式账)
 * 出口:全过 exit 0;任一断言失败 exit 1
 */
const BASE = process.env.YINJIA_API_BASE || 'http://127.0.0.1:8090/api'
const FACTORY = process.argv[2] || 'YJ_TEST'
const CRED = { userName: 'admin', password: '123456' }
const SUP = 'GYS00002'
const today = () => new Date().toISOString().slice(0, 10)

let auth = null
let fail = 0
const j = (o) => JSON.stringify(o)
const log = (...a) => console.log(...a)
function chk(id, name, pass, detail) {
  if (pass) log(`  \u2713 [${id}] ${name}${detail === undefined ? '' : '  \u2192 ' + detail}`)
  else { fail++; log(`  \u2717 [${id}] ${name}${detail === undefined ? '' : '  \u2192 ' + detail}`) }
}

async function apiFetch(p, init = {}) {
  const res = await fetch(BASE + p, init)
  let body
  try { body = await res.json() } catch { body = { code: res.status, message: 'non-json' } }
  return { http: res.status, body }
}
const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...auth.authHeader })
const okRes = (r) => r && r.code === 200
const msgOf = (r) => String((r && (r.message || r.data?.message)) || j(r)).slice(0, 220)

async function call(panel, button, formData) {
  const r = await apiFetch('/px/callButton', {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ panelCode: panel, buttonName: button, formData }),
  })
  return r.body
}
async function listAll(panel, pageSize = 500) {
  const r = await apiFetch('/px/queryFormDataList', {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize, condition: {} }),
  })
  return r.body?.data?.list ?? []
}
async function view(panel, no) {
  const r = await apiFetch('/px/getFormDescriptor?panelCode=' + encodeURIComponent(panel) + '&code=' + encodeURIComponent(no),
    { headers: auth.authHeader })
  const d = r.body?.data ?? {}
  return { head: d.data ?? {}, items: d.detailData?.items ?? [] }
}
async function del(panel, codes) {
  if (!codes.length) return
  await apiFetch('/px/deleteForms', {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ panelCode: panel, rowCodes: codes }),
  })
}

async function main() {
  log(`检验单审核 → 暂收退回单 E2E　API=${BASE}　账套=${FACTORY}`)

  const lr = await apiFetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ...CRED, factory: FACTORY }),
  })
  auth = { authHeader: { Authorization: 'Bearer ' + lr.body?.data?.token } }
  if (!lr.body?.data?.token) throw new Error('登录失败: ' + msgOf(lr.body))
  log(`[login] ok  factory=${lr.body.data.user?.factory}`)

  const before = new Set((await listAll('QC_RETURN')).map((d) => d['编号']))
  let ijNo = null, thNo = null
  try {
    // ── 直接建一张来料检验单:一行全合格(不良 0)、一行全不良(不良 80) ──
    //   (不走「送料暂收单生单」—— 那条路另有 bs_inv.来料检验 列缺失的独立故障,见报告)
    const items = [
      { 物料编码: 'CL004', 物料名称: '切削液', 计量单位: '升', 送检数量: 100, 合格数量: 100, 不合格数量: 0 },
      { 物料编码: 'CL004', 物料名称: '切削液', 计量单位: '升', 送检数量: 80, 合格数量: 0, 不合格数量: 80 },
    ]
    const s = await call('QC_INSP', '保存', { 单据日期: today(), 供应商: SUP, detail: { items } })
    chk('A1', '建来料检验单(一行合格 100 / 一行不良 80)', okRes(s), msgOf(s))
    if (!okRes(s)) throw new Error('建单失败,后续无法验证')
    ijNo = s.data['编号']
    log(`       检验单号 = ${ijNo}`)

    // ── 审核(触发 inspAutoPurchaseIn + inspAutoReturn) ──
    const a = await call('QC_INSP', '审核', { 编号: ijNo })
    chk('A2', '检验单审核', okRes(a), msgOf(a.data ?? a))

    // ── 断言:退回单 ──
    const after = (await listAll('QC_RETURN')).filter((d) => !before.has(d['编号']))
    const mine = after.filter((d) => d['检验单号'] === ijNo)
    chk('A3', '不良行 → 自动生成暂收退回单', mine.length === 1,
      `新增退回单 ${after.length} 张,其中检验单号=${ijNo} 的 ${mine.length} 张 ${j(after.map((d) => d['编号']))}`)
    if (mine.length !== 1) throw new Error('没生成退回单 —— 这正是本次要修的口径')
    thNo = mine[0]['编号']
    log(`       退回单号 = ${thNo}`)

    const tv = await view('QC_RETURN', thNo)
    chk('A4', '退回单只收不良行(1 行,不是 2 行)', tv.items.length === 1, `行数=${tv.items.length}`)
    chk('A5', '退回行 退货数量 = 不合格数量(80)', Number(tv.items[0]?.['退货数量']) === 80,
      '退货数量=' + tv.items[0]?.['退货数量'])
    chk('A6', '退回行 送检数量 随链带走(80)', Number(tv.items[0]?.['送检数量']) === 80,
      '送检数量=' + tv.items[0]?.['送检数量'])
    chk('A7', '退回单头带入检验单号', String(tv.head['检验单号'] ?? '') === ijNo, '检验单号=' + tv.head['检验单号'])

    // ── 采购入库侧同时校验(合格行 100 那张,证明双出口都活着) ──
    const pis = (await listAll('PURCHASE_IN')).filter((d) => d['来源单号'] === ijNo && d['来源单据'] === '来料检验单')
    chk('A8', '合格行 → 仍生成采购入库单(双出口不被改坏)', pis.length === 1,
      `入库单 ${pis.length} 张 ${j(pis.map((d) => d['编号']))}`)
  } finally {
    // ── 清理:弃审级联作废下游 → 再尝试删单体 ──
    //   注意:弃审会把 yj_doc_status.canceled 置 'Y',而成品删除守卫是「仅草稿状态可删除」⇒
    //   作废后的单**删不掉**(作废留痕,非缺陷)。故测试账套会留几张「已作废」单据,属正常。
    try {
      if (ijNo) await call('QC_INSP', '弃审', { 编号: ijNo })
      const pis = ijNo ? (await listAll('PURCHASE_IN')).filter((d) => d['来源单号'] === ijNo) : []
      for (const p of pis) { await call('PURCHASE_IN', '弃审', { 编号: p['编号'] }).catch(() => {}) }
      await del('QC_RETURN', thNo ? [thNo] : [])
      await del('PURCHASE_IN', pis.map((d) => d['编号']))
      await del('QC_INSP', ijNo ? [ijNo] : [])
      log('[清理] 已弃审并尝试删除(已作废单据按守卫留痕,不会真删)')
    } catch (e) { log('[清理] 有残留,请手工处理: ' + e.message) }
  }

  log('')
  if (fail === 0) log('[PASS] 检验单审核 → 暂收退回单 链路正常(8 项断言全过)')
  else { log(`[FAIL] ${fail} 项不符`); process.exit(1) }
}
main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1) })
