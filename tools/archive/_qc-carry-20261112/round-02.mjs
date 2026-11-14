/* round-02.mjs — 用页面自己的接口建 3 张检验数据记录草稿(与「新增」同一条保存路径),
   填物料/数量;随后把编号打印出来,下一步在界面里点「带入检验要求」 */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')

const API = (path, body) => page.evaluate(async ({ path, body }) => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token ? 'Bearer ' + token : '' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const text = await r.text()
  return { status: r.status, body: text.slice(0, 600) }
}, { path, body })

// ① 建 3 张空草稿
const docs = []
for (let i = 0; i < 3; i++) {
  const res = await API('/px/callButton', { panelCode: 'QC_INSP_REC', buttonName: '保存为草稿', formData: {}, buttonParam: {} })
  let no = ''
  try { no = JSON.parse(res.body)?.data?.编号 || JSON.parse(res.body)?.data?.formNo || '' } catch (e) { }
  console.log('创建 ' + (i + 1) + ' ->', res.status, no, res.status === 200 ? '' : res.body)
  docs.push(no)
}
console.log('草稿编号 = ' + JSON.stringify(docs))

// ② 填物料/数量(物料:折叠棉 YJ-YCYX-006 / -008 / -009;数量各不同)
const MATS = [
  { 物料编码: 'YJ-YCYX-006', 物料名称: '折叠棉', 来料数量: '1000个', 物料批次: 'YCYX-20261112-06' },
  { 物料编码: 'YJ-YCYX-008', 物料名称: '折叠棉', 来料数量: '1500个', 物料批次: 'YCYX-20261112-08' },
  { 物料编码: 'YJ-YCYX-009', 物料名称: '折叠棉', 来料数量: '2000个', 物料批次: 'YCYX-20261112-09' },
]
for (let i = 0; i < docs.length; i++) {
  const no = docs[i]
  if (!no) continue
  const formData = { 编号: no, 单据编号: no, 检验日期: '2026-11-12', ...MATS[i] }
  const res = await API('/px/callButton', { panelCode: 'QC_INSP_REC', buttonName: '保存为草稿', formData, buttonParam: {} })
  console.log('填物料 ' + no + ' ->', res.status, res.status === 200 ? 'ok' : res.body)
}
console.log('DONE docs=' + JSON.stringify(docs))
