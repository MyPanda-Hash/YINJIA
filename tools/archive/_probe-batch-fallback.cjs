/* 临时探针(任务产物,提交归 tools/archive):验证「打印标识卡」批次兜底链对老单的实际效果。
 * 兜底口径(同 PanelxList.vue 打印分支):行批次号 → 头批次号 → docNoFromDate(单据日期)=yyyyMMdd。
 * 用法:node _probe-batch-fallback.cjs [单据编号,默认 PI-2026-09-0013] */
const BASE = 'http://127.0.0.1:8090/api'
const DOC_NO = process.argv[2] || 'PI-2026-09-0013'

/** 与 @core/panel/docDefaults.docNoFromDate 同源:'2026-09-28' → '20260928' */
const docNoFromDate = (s) => { const d = String(s ?? '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(0, 8) : '' }

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json())
  const token = login?.data?.token
  const res = await fetch(`${BASE}/px/getFormDescriptor?panelCode=PURCHASE_IN&code=${encodeURIComponent(DOC_NO)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  const doc = res?.data?.data || {}
  const lines = Object.values(res?.data?.detailData || {})[0] || []
  const headBatch = doc['批次号'] || docNoFromDate(doc['单据日期']) || ''
  const rows = (lines || []).filter((l) => l && l['存货编码']).map((l) => ({
    编码: l['存货编码'], 批次: l['批次号'] || l['批号'] || headBatch,
  }))
  console.log(`单据 ${DOC_NO}: 头批次号=${JSON.stringify(doc['批次号'])} 单据日期=${doc['单据日期']} → 兜底头批次=${JSON.stringify(headBatch)}`)
  for (const r of rows) {
    const qr = ['0', r['编码'], r['批次'] || ''].filter((s) => s !== '').join('@')
    console.log(`  行 ${r['编码']} → 卡面批次=${JSON.stringify(r['批次'])} 二维码=${qr}${r['批次'] ? '' : '  ← 仍无批号(连单据日期都没有)'}`)
  }
  if (!rows.length) console.log('  (无可打印明细行)')
}
main().catch((e) => { console.error(e); process.exit(1) })
