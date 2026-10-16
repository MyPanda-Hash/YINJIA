/**
 * _q-kingdee-import-verify.mjs — 导完金蝶数据后的「活体页面口径」核对(只读):
 * 两个账套各登录一次,按面板查 `queryFormDataList` 的总数,和 CSV 行数/库内行数对账。
 * 用法: node tools/archive/_kingdee-reimport-20261016/_q-kingdee-import-verify.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'

// 面板 → 本次导入后**面板可见**的单数(SALE_OUT 的头表有 415 行,其中 2 张 yj_doc_status.canceled='Y' 已作废,列表不列 ⇒ 413)
const EXPECT = {
  PU_ORDER: 223, SO_ORDER: 334, PURCHASE_IN: 313, SALE_OUT: 413, MATERIAL_OUT: 487,
  FINISH_IN: 232, OTHER_IN: 14, OTHER_OUT: 79, QC_RECV: 293, QC_INSP: 11, QC_INSP_REC: 30,
}

const post = async (p, body, token) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  return { status: r.status, json: await r.json().catch(() => null) }
}

let bad = 0
for (const [label, factory] of [['正式账套 YJ', undefined], ['测试账套 YJ_TEST', 'YJ_TEST']]) {
  const login = await post('/auth/login', { userName: 'admin', password: '123456', ...(factory ? { factory } : {}) })
  if (login.json?.code !== 200) { console.log(`[FAIL] ${label} 登录失败`); bad++; continue }
  const token = login.json.data.token
  const out = []
  for (const [panel, want] of Object.entries(EXPECT)) {
    const q = await post('/px/queryFormDataList', { panelCode: panel, pageNo: 1, pageSize: 1, condition: {} }, token)
    const got = q.json?.data?.totalSize ?? q.json?.data?.total ?? q.json?.data?.count ?? null
    const ok = got === want
    if (!ok) bad++
    out.push(`${panel}:${q.status} 单数 ${got ?? '?'}${ok ? '' : `(期望 ${want})`}`)
  }
  console.log(`\n[${label}]`)
  console.log('  ' + out.join('\n  '))
}
console.log(bad === 0 ? '\n[OK] 两账套面板单数与导入结果一致' : `\n[FAIL] ${bad} 处不一致`)
process.exit(bad === 0 ? 0 : 1)
