// _probe-lab-save.cjs — 诊断:RD_EQUIP_USE 带行保存为何不归档
// 1) 空表头保存(directAdd 同路径) 2) 带一行明细保存 3) 带单据日期保存 —— 看各步返回与状态
const BASE = process.argv[2] || 'http://localhost:8090'
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m)
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, body) => (await fetch(`${BASE}${p}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })).json()
  const listRows = async (panel) => {
    const r = await api('/api/px/queryFormDataList', { panelCode: panel, pageNo: 1, pageSize: 300 })
    const d = r?.data || {}
    return d.rows || d.list || d.records || []
  }
  // ① 空表头新建(directAdd 路径)
  const c1 = await api('/api/px/callButton', { panelCode: 'RD_EQUIP_USE', buttonName: '保存', formData: {}, buttonParam: {} })
  const no = c1?.data?.['编号'] || c1?.data?.formNo
  console.log('① 空表头保存 →', JSON.stringify(c1).slice(0, 200))
  // ② 带一行明细保存(UI 同构载荷:头字段 + detail.items)
  const c2 = await api('/api/px/callButton', { panelCode: 'RD_EQUIP_USE', buttonName: '保存', formData: {
    '编号': no, '单据编号': no, '单据日期': '2026-09-11', '设备名称': '加标测试系统1#',
    detail: { items: [{ '使用日期': '2026-09-11', '测试项目': 'API探针行', '测试标准': '', '使用工位': '', '设备状态': '', '使用人': 'admin', '备注': '' }] },
  }, buttonParam: {} })
  console.log('② 带行保存 →', JSON.stringify(c2).slice(0, 300))
  const row = (await listRows('RD_EQUIP_USE')).find((r) => (r['单据编号'] || r['编号']) === no)
  console.log('   状态=', row?.['单据状态'], ' 明细行数=', (row?.detail?.items || []).length, ' 首行=', JSON.stringify((row?.detail?.items || [])[0] || {}).slice(0, 160))
  ok(row?.['单据状态'] === '已归档', '②-1 带行保存后已归档')
  ok((row?.detail?.items || []).some((r) => r['测试项目'] === 'API探针行'), '②-2 明细行已落库')
  // ③ 清理
  const del = await api('/api/px/callButton', { panelCode: 'RD_EQUIP_USE', buttonName: '删除', formData: { 编号: no }, buttonParam: {} })
  ok(del.code === 200, '③ 清理 ' + no)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
