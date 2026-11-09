// round-06 — 查:纸面单头「产品编码」实际值 + 弹窗取数接口实返 + 测试库夹具是否生效
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')

const facts = await page.evaluate(async () => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const bodyInputs = [...document.querySelectorAll('.qr-grid tbody input')].map((i) => i.value)
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/qc/inspPlan/fromShipPlan?productCode=' + encodeURIComponent('B-92-25'), {
    headers: { Authorization: 'Bearer ' + token },
  })
  const j = await r.json().catch(() => null)
  return {
    bodyInputs: bodyInputs.slice(0, 10),
    tokenLen: token.length,
    apiHttp: r.status,
    apiPlanNo: j?.data?.planNo ?? null,
    apiRows: (j?.data?.rows || []).length,
    apiFreqSample: (j?.data?.rows || []).slice(0, 3).map((x) => x['检查频率']),
    apiFirstRowKeys: j?.data?.rows?.[0] ? Object.keys(j.data.rows[0]) : [],
    dialogsOpen: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => txt(d.querySelector('.el-dialog__title'))),
  }
})
console.log('FACTS ' + JSON.stringify(facts, null, 2))
await page.screenshot({ path: OUT + '/r6-debug.png' })
console.log('DONE')
