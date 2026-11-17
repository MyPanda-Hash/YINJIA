/* probe-catalog-maintain.mjs:验证「送样登记表也可正常添加其他项」(档案面板 patch 保存=新增一行,再作废该行)
 * 只写测试账套 HSDZ_MES_TEST。 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
const call = async (method, path, body) => {
  const r = await fetch(BASE + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = { raw: t.slice(0, 300) } }
  return { http: r.status, j }
}
const results = []
const check = (n, ok, d) => results.push({ n, ok, d })

let q = await call('POST', '/px/queryFormDataList', { panelCode: 'SAMPLE_REG', keyword: '', condition: {}, pageNo: 1, pageSize: 50 })
const before = (q.j?.data?.list?.[0]?.detail?.items || [])
check('送样登记表基线 44 行', before.length === 44, before.length)

const newRow = {
  序号: 45,
  检测元素: '联调新增项(待删)',
  内部检出限: '0.01ppm',
  检测误差: '5%',
  测试方法: 'ICPMS',
  测试周期: '一天',
  '收费（一个样/元）': 88,
  检测标准: 'GB/T 5750.6-2023',
  检测标准备注: '目录可维护性联调',
  备注: 'E2E 临时行',
}
let r = await call('POST', '/px/callButton', {
  panelCode: 'SAMPLE_REG', buttonName: '保存',
  formData: { 编号: '送样登记表', detail: { items: [newRow] } },
  buttonParam: { 只提交改动行: true },
})
check('新增一行保存成功', r.http === 200 && r.j?.code === 200, JSON.stringify(r.j?.message || '').slice(0, 160))

q = await call('POST', '/px/queryFormDataList', { panelCode: 'SAMPLE_REG', keyword: '联调新增项', condition: {}, pageNo: 1, pageSize: 50 })
const rows2 = (q.j?.data?.list?.[0]?.detail?.items || [])
check('新增后能查到该项', rows2.some((x) => x['检测元素'] === '联调新增项(待删)'), rows2.map((x) => x['检测元素']).join(','))
q = await call('POST', '/px/queryFormDataList', { panelCode: 'SAMPLE_REG', keyword: '', condition: {}, pageNo: 1, pageSize: 50 })
const all2 = (q.j?.data?.list?.[0]?.detail?.items || [])
check('新增后总数 45', all2.length === 45, all2.length)
const added = all2.find((x) => x['检测元素'] === '联调新增项(待删)')
check('新行收费落库 88', Number(added?.['收费（一个样/元）'] ?? added?.['收费']) === 88, JSON.stringify(added?.['收费（一个样/元）'] ?? added?.['收费']))

// 作废该行(档案 patch 模式:作废行id)
r = await call('POST', '/px/callButton', {
  panelCode: 'SAMPLE_REG', buttonName: '保存',
  formData: { 编号: '送样登记表', detail: { items: [] }, 作废行id: [added?.id] },
  buttonParam: { 只提交改动行: true },
})
check('作废测试行成功', r.http === 200 && r.j?.code === 200, JSON.stringify(r.j?.message || '').slice(0, 160))
q = await call('POST', '/px/queryFormDataList', { panelCode: 'SAMPLE_REG', keyword: '', condition: {}, pageNo: 1, pageSize: 50 })
const all3 = (q.j?.data?.list?.[0]?.detail?.items || [])
check('作废后回到 44 行', all3.length === 44, all3.length)

const failed = results.filter((x) => !x.ok)
for (const x of results) console.log((x.ok ? 'PASS ' : 'FAIL ') + x.n + (x.ok ? '' : ' => ' + JSON.stringify(x.d)))
console.log(`=== ${results.length - failed.length}/${results.length} PASS ===`)
process.exit(failed.length ? 1 : 0)
