/**
 * _probe-batch-sync-crash.cjs — 只读排查:哪些面板「保存」会撞 syncBatchNo 的未加守卫查询
 * 现象:qc_jjf 保存报 列名 '批次键' 无效(BatchService.syncBatchNo 第 210 行无条件查 批次键,
 *      而 qc_jjf/qc_return 没有该列)。本探针逐面板建一张空白草稿 → 带内容保存一次 → 记结果。
 * 用法:node tools/archive/_probe-batch-sync-crash.cjs
 */
const API = 'http://127.0.0.1:8090/api'
const PANELS = ['QC_JJF', 'QC_RETURN', 'QC_TC_IN', 'PROD_ABN']

async function login() {
  const j = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(JSON.stringify(j).slice(0, 200))
  return j.data.token
}

const token = await login()
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
const cb = async (panel, button, fd) =>
  (await (await fetch(API + '/px/callButton', {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName: button, formData: fd || {}, buttonParam: {} }),
  })).json())
const okc = (j) => j.code === 0 || j.code === 200

for (const P of PANELS) {
  let no = ''
  try {
    const mk = await cb(P, '新增流程', {})
    if (!okc(mk)) { console.log(`${P}: 建单失败 ${JSON.stringify(mk).slice(0, 160)}`); continue }
    no = String(mk.data['编号'])
    const sv = await cb(P, '保存', { 编号: no })
    console.log(`${P} ${no} 保存 → ${okc(sv) ? 'OK' : JSON.stringify(sv).slice(0, 220)}`)
    if (okc(sv)) {
      const del = await cb(P, '删除', { 编号: no })
      console.log(`        清理: ${okc(del) ? '已作废' : JSON.stringify(del).slice(0, 120)}`)
    }
  } catch (e) { console.log(`${P}: ${e.message}`) }
}
