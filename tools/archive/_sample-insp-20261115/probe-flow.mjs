/* 检验委托单 后端流程 E2E(只写测试账套 HSDZ_MES_TEST):
 *   新增空白草稿 → 保存(带从送样登记表带入的 3 个检验项目) → 提交审批 → 审批通过 → 已审核
 *   → 弃审 → 草稿;并断言 号池前缀 WT / 状态流转 / 审核人落值 / 审批留痕。
 * 用法:node probe-flow.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('login failed ' + JSON.stringify(j).slice(0, 300))
  return j.data.token
}

function client(token) {
  return async (method, path, body) => {
    const r = await fetch(BASE + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    let j; try { j = JSON.parse(text) } catch { j = { raw: text.slice(0, 500) } }
    return { http: r.status, j }
  }
}

const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); }

const token = await login()
const call = client(token)

// ① 新增空白草稿
let r = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '新增', formData: {}, buttonParam: {} })
check('新增空白草稿 HTTP 200', r.http === 200 && r.j?.code === 200, r.j?.message)
const draftNo = r.j?.data?.['编号'] || r.j?.data?.['单据编号'] || ''
check('新增返回 WT 号', /^WT-/.test(String(draftNo)), draftNo)

// ② 从送样登记表取 3 个检验项目(锂 / 钠 / 镁)
r = await call('POST', '/px/queryFormDataList', { panelCode: 'SAMPLE_REG', keyword: '', condition: {}, pageNo: 1, pageSize: 50 })
const cat = (r.j?.data?.list?.[0]?.detail?.items) || []
const pick = ['锂', '钠', '镁'].map((n) => cat.find((x) => x['检测元素'] === n)).filter(Boolean)
check('送样登记表可取到目录行', cat.length >= 44 && pick.length === 3, `catalog=${cat.length} picked=${pick.length}`)
const items = pick.map((p, i) => ({
  行号: i + 1,
  检测元素: p['检测元素'],
  内部检出限: p['内部检出限'],
  检测误差: p['检测误差'],
  测试方法: p['测试方法'],
  测试周期: p['测试周期'],
  '收费（一个样/元）': p['收费（一个样/元）'],
  检测标准: p['检测标准'],
}))
const fee = items.reduce((s, x) => s + Number(x['收费（一个样/元）'] || 0), 0)

// ③ 保存(带表头 + 带入的 3 行)
const head = {
  单据编号: draftNo,
  单据日期: '2026-11-15',
  委托单位: '流程联调测试委托单位',
  委托单位地址: '惠州市惠城区测试路 1 号',
  制造商: '测试制造商',
  联系人: '张三',
  '联系电话（手机）': '13800000000',
  邮箱: 'test@example.com',
  样品名称: '测试水样',
  商标: 'YINJIA',
  样品数量: '2L',
  '样品型号/规格': '500mL 瓶装',
  检验类别: items.map((x) => x['检测元素']).join('、'),
  检验依据: 'GB/T 5750.6-2023 / HJ700-2014',
  检验项目及要求: '部分项目：金属元素（第 6 章）',
  样品处理方式: '委托单位自行取走',
  判定规则: '无需判定',
  检验报告有效期: '长期有效',
  合计收费: fee,
  备注: '流程联调测试单据，可删',
}
r = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '保存', formData: { ...head, detail: { items } }, buttonParam: {} })
const savedNo = r.j?.data?.['编号'] || r.j?.data?.['单据编号'] || draftNo
check('保存成功', r.http === 200 && r.j?.code === 200, JSON.stringify(r.j?.message || r.j?.data || {}).slice(0, 200))
check('保存后单据号为 WT 号', /^WT-/.test(String(savedNo)), savedNo)

// ④ 重新读回校验落库
r = await call('POST', '/px/queryFormDataList', { panelCode: 'INSP_COMMISSION', keyword: savedNo, condition: {}, pageNo: 1, pageSize: 10 })
let doc = (r.j?.data?.list || []).find((d) => (d['单据编号'] || d['编号']) === savedNo)
check('读回单据', !!doc && doc['单据状态'] === '草稿', doc ? doc['单据状态'] : 'not found')
check('读回行表 3 行', (doc?.detail?.items || []).length === 3, String((doc?.detail?.items || []).length))
check('读回合计收费', Number(doc?.['合计收费']) === fee, `${doc?.['合计收费']} vs ${fee}`)
check('读回检验类别', doc?.['检验类别'] === '锂、钠、镁', doc?.['检验类别'])

// ⑤ 提交审批
r = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '提交审批', formData: { ...head, 编号: savedNo, 单据编号: savedNo, detail: { items } }, buttonParam: {} })
check('提交审批成功', r.http === 200 && r.j?.code === 200, JSON.stringify(r.j?.message || '').slice(0, 200))

// ⑥ 审批通过
r = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '审批通过', formData: { ...head, 编号: savedNo, 单据编号: savedNo, detail: { items } }, buttonParam: { opinion: '联调自动审批通过' } })
check('审批通过成功', r.http === 200 && r.j?.code === 200, JSON.stringify(r.j?.message || '').slice(0, 200))

r = await call('POST', '/px/queryFormDataList', { panelCode: 'INSP_COMMISSION', keyword: savedNo, condition: {}, pageNo: 1, pageSize: 10 })
doc = (r.j?.data?.list || []).find((d) => (d['单据编号'] || d['编号']) === savedNo)
check('审批后状态=已审核', doc?.['单据状态'] === '已审核', doc?.['单据状态'])
check('审批后审核人落值', !!doc?.['审核人'], doc?.['审核人'])

// ⑦ 审批留痕
r = await call('GET', `/px/getApprovalHistory?panelCode=INSP_COMMISSION&code=${encodeURIComponent(savedNo)}`)
const hist = r.j?.data || []
const actions = hist.map((h) => h.action)
check('审批留痕含 SUBMIT/APPROVE', actions.includes('SUBMIT') && actions.includes('APPROVE'), actions.join(','))

// ⑧ 弃审回草稿
r = await call('POST', '/px/callButton', { panelCode: 'INSP_COMMISSION', buttonName: '弃审', formData: { ...head, 编号: savedNo, 单据编号: savedNo, detail: { items } }, buttonParam: {} })
check('弃审成功', r.http === 200 && r.j?.code === 200, JSON.stringify(r.j?.message || '').slice(0, 200))
r = await call('POST', '/px/queryFormDataList', { panelCode: 'INSP_COMMISSION', keyword: savedNo, condition: {}, pageNo: 1, pageSize: 10 })
doc = (r.j?.data?.list || []).find((d) => (d['单据编号'] || d['编号']) === savedNo)
check('弃审后状态=草稿', doc?.['单据状态'] === '草稿', doc?.['单据状态'])

const failed = results.filter((x) => !x.ok)
console.log('单号:', savedNo, '| 测试项:', items.map((x) => x['检测元素']).join(','), '| 合计:', fee)
for (const x of results) console.log((x.ok ? 'PASS ' : 'FAIL ') + x.name + (x.ok ? '' : ' => ' + JSON.stringify(x.detail)))
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS, ${failed.length} FAIL ===`)
process.exit(failed.length ? 1 : 0)
