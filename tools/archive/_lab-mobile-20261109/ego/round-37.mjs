const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const tok = localStorage.getItem('mes_token')
  const res = await fetch('/api/px/getPanelConfig?panelCode=RD_EQUIP_USE', { headers: { Authorization: 'Bearer ' + tok } })
  const txt = await res.text()
  let fields = null
  try { fields = JSON.parse(txt)?.data?.dataSchema?.fields?.length ?? null } catch (e) { fields = 'parse-err' }
  return {
    status: res.status,
    fieldsLen: fields,
    overlay: !!document.querySelector('vite-error-overlay'),
    panelx: document.querySelectorAll('.panelx-list').length,
    toastTexts: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
    tokLen: (tok || '').length,
    bodyStart: txt.slice(0, 160),
  }
})
console.log(JSON.stringify(out, null, 2))
