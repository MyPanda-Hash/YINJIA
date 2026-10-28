/**
 * _v-doc-status-sync.cjs — 单据状态(审核/作废/删除)必须与采购订单一致(2026-10-25)
 *
 * 用户报障:「采购订单删除数据,供应商打印并不同步」。
 * 根因:单据状态不存业务表,存 `yj_doc_status(panel_code, doc_no)` ——
 * 供应商面板是另一个 panel_code,按自己的编码去查一条都查不到 ⇒
 * 列表里全是「草稿」、已删除的单据排除不掉、条数比采购订单多(PanelAliases 折算修复)。
 *
 * 断言:
 *   ① 两个面板的总条数相同(删除的已排除);
 *   ② 同一批单号在两边「单据状态」逐条相同(不再是清一色草稿);
 *   ③ 两边状态分布(已审核/草稿/已作废…)的计数相同;
 *   ④ 已作废/已删除的单据两边都查不到;
 *   ⑤ 供应商范围仍只到自己的供应商。
 *
 * 用法:node tools/archive/_v-doc-status-sync.cjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const SUP_USER = process.argv[3] || 'kbl01'
const SUP_PASS = process.argv[4] || 'kbl@2026'

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
async function call(p, { method = 'GET', token, body } = {}) {
  const r = await fetch(BASE + p.replace(/^\//, ''), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch (e) { return { raw: t, http: r.status } }
}
async function page(panel, token, pageNo) {
  return (await call('api/px/queryFormDataList', {
    method: 'POST', token,
    body: { panelCode: panel, condition: {}, pageNo: pageNo || 1, pageSize: 50 },
  })).data
}

async function main() {
  const at = (await call('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })).data.token
  const st = (await call('api/auth/login', { method: 'POST', body: { userName: SUP_USER, password: SUP_PASS, factory: 'YJ' } })).data
  if (!st || !st.token) throw new Error('供应商测试账号不可用')
  const supTok = st.token

  // ---------- ① 总条数 ----------
  console.log('\n== ① 总条数(已删除的必须两边都排除) ==')
  const a1 = await page('PU_ORDER', at, 1)
  const b1 = await page('SUPPLIER_PU_ORDER', at, 1)
  check('采购订单与供应商面板总条数一致', a1.totalSize === b1.totalSize,
    `采购订单 ${a1.totalSize} / 供应商 ${b1.totalSize}`)

  // ---------- ②③ 逐单状态与分布 ----------
  console.log('\n== ② 逐单「单据状态」相同 ==')
  const a2 = await page('PU_ORDER', at, 1)
  const b2 = await page('SUPPLIER_PU_ORDER', at, 1)
  const mapB = new Map((b2.list || []).map((r) => [r['单据编号'], r['单据状态']]))
  let same = 0
  let diff = []
  for (const r of (a2.list || [])) {
    const k = r['单据编号']
    if (!mapB.has(k)) continue
    if (mapB.get(k) === r['单据状态']) same++
    else diff.push(`${k}: 采购订单=${r['单据状态']} 供应商=${mapB.get(k)}`)
  }
  check('两边都有的单,状态逐条相同', diff.length === 0 && same > 0,
    diff.length ? diff.slice(0, 3).join(' ; ') : `${same} 张一致`)
  const dist = (list) => {
    const m = {}
    for (const r of list) m[r['单据状态']] = (m[r['单据状态']] || 0) + 1
    return m
  }
  const da = dist(a2.list || [])
  const db = dist(b2.list || [])
  check('两边状态分布相同', JSON.stringify(da) === JSON.stringify(db),
    `采购订单 ${JSON.stringify(da)} / 供应商 ${JSON.stringify(db)}`)
  check('不再是清一色「草稿」', Object.keys(da).some((k) => k !== '草稿') && Object.keys(db).some((k) => k !== '草稿'),
    `供应商端分布 ${JSON.stringify(db)}`)

  // ---------- ④ 已作废/删除的单据两边都查不到 ----------
  console.log('\n== ④ 已作废/已删除的单据两边都不出现 ==')
  const allA = []
  const pages = Math.min(3, Math.ceil((a1.totalSize || 0) / 50))
  for (let p = 1; p <= pages; p++) allA.push(...((await page('PU_ORDER', at, p)).list || []))
  const canceled = allA.filter((r) => ['已作废', '已删除'].includes(String(r['单据状态'])))
  check('样本里没有「已作废/已删除」的漏网单据', canceled.length === 0,
    canceled.length ? canceled.slice(0, 3).map((r) => r['单据编号']).join(',') : '样本干净')

  // ---------- ⑤ 供应商范围 ----------
  console.log('\n== ⑤ 供应商范围不受影响 ==')
  const me = st.user.supplierCode
  const wide = (await call('api/px/queryFormDataList', {
    method: 'POST', token: supTok,
    body: { panelCode: 'SUPPLIER_PU_ORDER', condition: {}, pageNo: 1, pageSize: 500 },
  })).data
  const rows = wide.list || []
  const others = rows.filter((r) => String(r['供应商编码'] || '') !== me).length
  check('返回行全部属于本供应商', rows.length > 0 && others === 0, `共 ${rows.length} 行,越界 ${others}`)

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
