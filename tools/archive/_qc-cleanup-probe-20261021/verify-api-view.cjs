const BASE = 'http://127.0.0.1:8090/api'
const CRED = { userName: 'admin', password: '123456' }
async function main() {
  const lr = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ...CRED, factory: 'YJ' }),
  }).then(r => r.json())
  const token = lr?.data?.token
  if (!token) throw new Error('login failed')
  const H = { Authorization: 'Bearer ' + token }
  async function view(panel, no) {
    const r = await fetch(BASE + '/px/getFormDescriptor?panelCode=' + encodeURIComponent(panel) + '&code=' + encodeURIComponent(no), { headers: H }).then(r => r.json())
    const d = r?.data ?? {}
    return { head: d.data ?? {}, items: d.detailData?.items ?? [] }
  }
  for (const [p, n] of [['QC_INSP','IJ-2026-10-0215'],['QC_CATALOG','JYML-2026-10-0001'],['QC_INSP_REC','JYSJ-2026-10-0105'],['QC_RETURN','TH-2026-10-0014']]) {
    const v = await view(p, n)
    console.log(`== ${p} ${n}: items=${v.items.length} status=${v.head['单据状态']} 审核人=${v.head['审核人']} 检验单号=${v.head['检验单号']}`)
    for (const it of v.items.slice(0, 3)) console.log('  ', it['物料编码']||'', it['物料名称']||'', it['送检数量']||it['退货数量']||it['数量']||'', it['检验项']||'', it['检测结果']||'', it['单项判定']||'')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
