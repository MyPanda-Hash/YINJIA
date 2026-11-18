// round-14: 已提交审批的单据不许改号(先提交审批,再试改号)
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

async function api(path, body) {
  return page.evaluate(async ({ path, body }) => {
    const token = localStorage.getItem('mes_token') || localStorage.getItem('token') || ''
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ? 'Bearer ' + token : '' },
      body: JSON.stringify(body),
    })
    let text = ''
    try { text = await r.text() } catch (e) { text = 'ERR ' + e.message }
    return { status: r.status, body: text.slice(0, 300) }
  }, { path, body })
}

const submit = await api('/api/px/callButton', {
  panelCode: 'INSP_COMMISSION',
  buttonName: '提交审批',
  formData: { 编号: 'WT-2026-11-9001' },
  buttonParam: {},
})
console.log('submit=' + JSON.stringify(submit))

const rename = await api('/api/px/callButton', {
  panelCode: 'INSP_COMMISSION',
  buttonName: '提交',
  formData: {
    编号: 'WT-2026-11-9001',
    单据编号: 'WT-2026-11-7777',
    单据日期: '2026-11-17',
    detail: { items: [{ 行号: 1, 检测元素: '锂' }] },
  },
  buttonParam: {},
})
console.log('rename-after-submit=' + JSON.stringify(rename))
