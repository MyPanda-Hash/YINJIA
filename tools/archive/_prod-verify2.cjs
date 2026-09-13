/**
 * _prod-verify2.cjs — 终验:6 面板归档状态 + 规格书 3 表区读回 + 配方合计
 */
const API = 'http://localhost:8090/api'
async function api(method, p, body, token) {
  const res = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, json: await res.json().catch(() => null) }
}
async function main() {
  await new Promise((r) => setTimeout(r, 12000))
  const lr = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = lr.json.data.token
  const docs = {}
  for (const pc of ['RD_MOLD_PROC', 'RD_MOLD_FORMULA', 'RD_ASM_BOM', 'RD_ASM_PROC', 'RD_INSP_PLAN']) {
    const s1 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: {}, buttonParam: {} }, token)
    const no = s1.json?.data?.['编号']
    const head = pc === 'RD_MOLD_FORMULA' ? { 产品编号: 'C-95-43' } : {}
    const items = pc === 'RD_MOLD_FORMULA'
      ? [{ 序号: '1', 物料种类: '炭粉', 物料编号: 'YJ-XH-002', 物料名称: '鑫恒酸洗（80-250）', 实际添加比例: '0.62', 单支物料含量: '290.26', 设计添加量: '0.62' }]
      : []
    const s2 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: { 编号: no, ...head, detail: { items } }, buttonParam: {} }, token)
    console.log(pc + ' -> ' + (s2.json?.data?.['单据状态'] || JSON.stringify(s2.json).slice(0, 80)))
    docs[pc] = no
  }
  // 规格书 3 表区
  const s1 = await api('POST', '/px/callButton', { panelCode: 'RD_SPEC_DOC', buttonName: '保存', formData: {}, buttonParam: {} }, token)
  const no = s1.json?.data?.['编号']
  const s2 = await api('POST', '/px/callButton', { panelCode: 'RD_SPEC_DOC', buttonName: '保存', formData: { 编号: no, 名称: '矿化后置烧结矿化棒', 编号: no, 客户名: '傲美', 版本: 'V20260826', detail: { items: [
    { 表区: '检验要求', 序号: '1', 检验项目: '*外观', 检验要求: '表面色泽均匀', 检验方法: '目视', 检验依据: '银嘉测试标准' },
    { 表区: '物料清单', 序号: '1', 物料编码: 'B-85-06', 物料名称: '矿化烧结棒', 规格参数: '外径27.5±0.5mm', 数量: '1' },
    { 表区: '修订记录', 序号: '1', 更改内容: '初次发行', 责任人: '杨茂林' },
  ] } }, buttonParam: {} }, token)
  console.log('RD_SPEC_DOC save -> ' + JSON.stringify(s2.json?.data))
  const list = await api('POST', '/px/queryFormDataList', { panelCode: 'RD_SPEC_DOC', condition: {}, pageNo: 1, pageSize: 3 }, token)
  const mine = (list.json?.data?.list || []).find((r) => r['编号'] === no)
  const items = (mine?.detail?.items) || []
  console.log('SPEC 读回 items=' + items.length + ' 表区s=' + [...new Set(items.map((r) => r['表区']))].join('/'))
  if (items[0]) console.log('row1: ' + JSON.stringify(items[0]).slice(0, 150))
  docs.RD_SPEC_DOC = no
  // 配方读回
  const fl = await api('POST', '/px/queryFormDataList', { panelCode: 'RD_MOLD_FORMULA', condition: {}, pageNo: 1, pageSize: 3 }, token)
  const fmine = (fl.json?.data?.list || []).find((r) => r['编号'] === docs.RD_MOLD_FORMULA)
  console.log('FORMULA 读回 items=' + ((fmine?.detail?.items) || []).length + ' row1比例=' + ((fmine?.detail?.items) || [])[0]?.['实际添加比例'])
  // 清理
  for (const [pc, n] of Object.entries(docs)) await api('POST', '/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: n }, buttonParam: {} }, token)
  console.log('CLEANED')
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
