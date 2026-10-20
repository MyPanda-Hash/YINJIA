/*
 * _erp-e2e-1019.mjs —— 暂收退料单「转ERP」端到端实推(测试账套 HSDZ_MES_TEST → 金蝶测试沙箱)
 *
 * 用法: node tools/archive/_1019-verify/_erp-e2e-1019.mjs [docNo]
 *   默认台账 = 测试账套(登录时 factory=TEST),默认单据 = TH-2026-10-0047
 *   (该单在 _erp-e2e-prep-test.sql 里已把 供应商/计量单位 改成沙箱档案里存在的
 *    广东元丰化学试剂有限公司 / kg;仓库留空 ⇒ 走"默认正品仓 CK00001 + 提示"那条路)
 *
 * 步骤:登测试账套 → 查询可转ERP(应含该单) → 转ERP → 核对回写四列 + 金蝶返回单号。
 */
const BASE = 'http://127.0.0.1:8090'
const DOC = process.argv[2] || 'TH-2026-10-0047'
let pass = 0, fail = 0
const ok = (c, label, extra = '') => {
  if (c) { pass++; console.log(`  PASS  ${label}${extra ? ' · ' + extra : ''}`) } else { fail++; console.log(`  FAIL  ${label}${extra ? ' · ' + extra : ''}`) }
}
async function main() {
  console.log(`\n[转ERP e2e] 测试账套 HSDZ_MES_TEST → 金蝶沙箱 · 单据 ${DOC}\n`)
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const lj = await lr.json()
  const token = lj?.data?.token
  ok(!!token, '登录测试账套成功', `factory=${lj?.data?.user?.factory}`)
  const api = async (path, body) => {
    const res = await fetch(`${BASE}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const t = await res.text()
    try { return JSON.parse(t) } catch { return { raw: t.slice(0, 300) } }
  }
  const list = await api('/px/callButton', { panelCode: 'QC_RETURN', buttonName: '查询可转ERP', formData: {}, buttonParam: {} })
  const rows = list?.data?.list || []
  ok(rows.length > 0, '「查询可转ERP」返回可转单据', `${rows.length} 张`)
  const hit = rows.find((r) => (r['单据编号'] || r['编号']) === DOC)
  ok(!!hit, `待转列表里含 ${DOC}`, hit ? `往来单位=${hit['往来单位']}` : '未命中(是否未审核/已转?)')
  const r = await api('/px/callButton', { panelCode: 'QC_RETURN', buttonName: '转ERP', formData: { 编号: DOC, 单据编号: DOC }, buttonParam: {} })
  const erp = r?.data?.ERP单号 || ''
  ok(r?.code === 200, '转ERP 调用未报错', `code=${r?.code} ${r?.message || r?.raw || ''}`.slice(0, 220))
  ok(!!erp, '金蝶返回了 ERP 单号', erp || JSON.stringify(r).slice(0, 240))
  ok(String(r?.data?.是否已转ERP) === '是', '回写 是否已转ERP=是')
  ok(!!r?.data?.转ERP时间, '回写 转ERP时间', String(r?.data?.转ERP时间 || ''))
  if (r?.data?.message) console.log(`        消息: ${r.data.message}`)
  console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[e2e 异常]', e); process.exit(2) })
