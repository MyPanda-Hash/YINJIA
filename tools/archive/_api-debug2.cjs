/**
 * _api-debug2.cjs — 深挖:碱性 400 报错体 + 矿化明细落库情况
 */
const BASE = 'http://localhost:8090/api'
async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}
async function main() {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = login.json.data.token

  // A) 碱性:逐块保存定位 400 原因
  const s1 = await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '保存', formData: {}, buttonParam: {} }, token)
  const no = s1.json?.data?.['编号']
  console.log('DRAFT:', no)
  // A1: 仅头字段
  const a1 = await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '保存', formData: { 编号: no, '测试主题': 'x' }, buttonParam: {} }, token)
  console.log('A1 HEAD-ONLY:', a1.status, a1.text.slice(0, 200))
  // A2: 头 + 1 行明细
  const a2 = await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '保存', formData: { 编号: no, '测试主题': 'x', detail: { items: [{ '测试时间': '2026.02.28', '钠': '17.5' }] } }, buttonParam: {} }, token)
  console.log('A2 HEAD+1ROW:', a2.status, a2.text.slice(0, 200))
  // A3: 完整头(全字段)
  const a3 = await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '保存', formData: { 编号: no, '文档编号': 'YJ-PD-01', '密级': '保密', '适用范围': '银嘉内部', '测试负责人': '冯敏', '报告编号': 'PD-H-F260228002', '测试主题': '伊可普碱性寿命测试', '测试目的/背景': '碱性寿命及口感测试', '测试时间': '2026.02.28', '炭棒尺寸': '24*10*120mm', '本次实验目的': '浸泡24H后TDS值测试', '测试仪器': 'PH计', '测试装置及工位': '工位1#', '测试方式': '冲5min泡24H', '原水自来水': '×', '原水超纯水': '×', '原水RO纯水': '√', '原水PH': '6', '原水TDS': '2', '水温': '22' }, buttonParam: {} }, token)
  console.log('A3 FULL-HEAD:', a3.status, a3.text.slice(0, 200))

  // B) 矿化:保存明细后直接查库(不走 getFormDescriptor)
  const m1 = await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '保存', formData: {}, buttonParam: {} }, token)
  const mno = m1.json?.data?.['编号']
  const m2 = await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '保存', formData: { 编号: mno, detail: { items: [{ '指标': '锶 mg/L', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '0', '浸泡30min': '2.47', '浸泡30min煮沸晾凉': '2.74' }] } }, buttonParam: {} }, token)
  console.log('MINERAL SAVE:', m2.status, m2.text.slice(0, 200))
  console.log('MINERAL NO FOR SQL:', mno)
  // getFormDescriptor 原文
  const rb = await api('GET', '/px/getFormDescriptor?panelCode=RD_MINERAL&code=' + encodeURIComponent(mno), null, token)
  console.log('FORM DESC RAW:', rb.text.slice(0, 600))
  // 清理
  await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '删除', formData: { 编号: mno }, buttonParam: {} }, token)
  await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }, token)
  console.log('CLEANED')
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
