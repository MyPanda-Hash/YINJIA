/**
 * _prod2-verify.cjs — 产品文件升级终验:6 面板保存/读回/归档
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
  const plans = [
    ['RD_PROD_INFO', { 产品编号: 'C-95-43', 产品名称: '1217项目后置副龙头芯', 产品类别: '阻垢', 产品类型: '成品', 产品整体尺寸: '63*35*246', 客户料号: '30501080014', 炭棒尺寸: '80*35*184', 特殊性能描述: '客户特殊要求', 下单数量: '1000', 产品分类: '重点产品', 产品形态: '包布', 责任人: '刘磊', 审核人: '冯总' }, []],
    ['RD_ASM_BOM', { 产品编号: 'T382', 产品名称: '除重金属炭棒滤芯', 产品种类: '成品（炭棒一端封底）', 整体规格外径: '63±0.5mm', 整体规格长度: '246±1mm', 成品重量: '＞345g', detail: { items: [
      { 表区: '修订记录', 序号: '1', 更改内容: '初次发行', 责任人: '刘磊' },
      { 表区: '物料清单', 物料名: '炭棒', 物料编号: 'C-95-43', 物料规格: '79*35*245mm', 外观要求: '清洁无破损', 用量: '2' },
    ] } }],
    ['RD_ASM_PROC', { detail: { items: [
      { 工序: '无黑处理', 工序控制内容: '无黑时间', 管控要求: '12-24小时', 检查比例: '随机2支' },
      { 工序: '投首', 工序控制内容: '尺寸外观', 管控要求: '外径79-80mm', 检查比例: '3%' },
    ] } }],
    ['RD_INSP_PLAN', { 标题: '伊可普碱性炭棒出货检验项目控制计划', 版本号: 'A260416', 产品编号: 'C-95-38', 客户名: '青岛伊可普', detail: { items: [
      { 检验类别: '必测项', 控制项目: '*外观', 检验: 'IQC', 控制方法: '常规抽检' },
      { 检验类别: '型式检验', 控制项目: '碱性寿命', 检验: 'IQC', 控制方法: '型式检测报告' },
    ] } }],
    ['RD_MOLD_PROC', { 产品编号: 'C-95-43', 烧结炉参数: '185度', 烧结时间调速器参数: '125分钟', 冷却参数设置: '打开全部冷却风扇' }, []],
  ]
  for (const [pc, head, items] of plans) {
    const s1 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: {}, buttonParam: {} }, token)
    const no = s1.json?.data?.['编号']
    if (!no) { console.log(pc + ' DRAFT FAIL: ' + JSON.stringify(s1.json).slice(0, 100)); continue }
    const flat = head.detail ? head : { ...head, detail: head.detail }
    const s2 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: { 编号: no, ...flat }, buttonParam: {} }, token)
    const list = await api('POST', '/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 3 }, token)
    const mine = (list.json?.data?.list || []).find((r) => r['编号'] === no)
    const nItems = ((mine?.detail?.items) || []).length
    console.log(pc + ' -> ' + (s2.json?.data?.['单据状态']) + ' items=' + nItems)
    await api('POST', '/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: no }, buttonParam: {} }, token)
  }
  console.log('ALL DONE')
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
