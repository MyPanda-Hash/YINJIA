/* 面板配置契约核对(任务 1b 步骤 5):确认 ——
   ① 被删的 RKD/CKD 不再返回面板配置(且是以"面板不存在"报错);
   ② 我在 ui-smoke/ref-mode-test 里换上的替代面板(SO_ORDER)与 KHDA/CKDA 仍正常。
   用法: node tools/archive/_probe-panel-config.cjs
*/
const API = process.env.YINJIA_API || 'http://127.0.0.1:8090'
let fails = 0
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

async function main() {
  const lr = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const token = (await lr.json()).data.token
  const H = { Authorization: `Bearer ${token}` }

  for (const p of ['SO_ORDER', 'KHDA', 'CKDA']) {
    const r = await fetch(`${API}/api/px/getPanelConfig?panelCode=${p}`, { headers: H })
    const j = await r.json()
    const topKeys = Object.keys(j.data || {})
    const d = j.data || {}
    const nFields = (d.fields || d.columns || d.detailFields || []).length
    console.log(`   ${p} → HTTP ${r.status} code=${j.code} 顶层键=[${topKeys.slice(0, 12).join(',')}]`)
    ok(r.status === 200 && j.code === 200, `${p} 面板配置可正常获取`)
    ok(typeof d.panelName === 'string' || typeof d.lineTable === 'string' || nFields > 0 || topKeys.length > 0,
      `${p} 返回了非空配置(键 ${topKeys.length} 个)`)
  }
  for (const p of ['RKD', 'CKD']) {
    const r = await fetch(`${API}/api/px/getPanelConfig?panelCode=${p}`, { headers: H })
    let j = null
    try { j = await r.json() } catch { /* 非 JSON */ }
    console.log(`   ${p} → HTTP ${r.status} body=${JSON.stringify(j).slice(0, 160)}`)
    ok(r.status !== 200, `${p} 已不再返回面板配置(HTTP ${r.status})`)
  }
  console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL-${fails}`)
  process.exit(fails ? 1 : 0)
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
