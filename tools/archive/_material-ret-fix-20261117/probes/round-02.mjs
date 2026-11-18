const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MATERIAL_RET', { timeout: 40000 })
await page.waitForTimeout(3000)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const call = async (url, body) => {
    const r = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
    })
    const t = await r.text()
    return { status: r.status, body: t.length > 600 ? t.slice(0, 600) : t }
  }
  const res = { factory: localStorage.getItem('mes_factory') || null }
  res.materialRet = await call('/api/px/queryFormDataList', { panelCode: 'MATERIAL_RET', condition: {}, pageNo: 1, pageSize: 20 })
  res.prodPick = await call('/api/px/queryFormDataList', { panelCode: 'PROD_PICK_LIST', condition: {}, pageNo: 1, pageSize: 5 })
  res.prodRet = await call('/api/px/queryFormDataList', { panelCode: 'PROD_RET_LIST', condition: {}, pageNo: 1, pageSize: 5 })
  return res
})
console.log(JSON.stringify(out, null, 2))
