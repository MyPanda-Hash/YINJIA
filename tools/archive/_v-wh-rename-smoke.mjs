// 仓库正名冒烟:三面板字段统一为「仓库」(参照 WH+必填)+ 台账/状况表存活
const BASE = 'http://localhost:8090/api'
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); if (!cond) process.exitCode = 1 }

const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const post = async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()).data
const get = async (p) => (await (await fetch(BASE + p, { headers: H })).json()).data

for (const code of ['PURCHASE_IN', 'SALE_OUT']) {
  const cfg = await get(`/px/getPanelConfig?panelCode=${code}`)
  const fields = cfg?.metadata?.panelPageDto?.tablePages?.[0] || {}
  const all = [...(fields.queryFields || []), ...(fields.headerFields || []), ...((cfg?.detail?.tabs || []).flatMap((t) => t.fields || []))]
  const old = all.find((f) => f.dataName === '仓库名称')
  const tabs = (cfg?.detail?.tabs || []).flatMap((t) => t.fields || [])
  const wh = tabs.find((f) => f.dataName === '仓库')            // 必填语义看**明细区**实例(查询区实例 isRequired=null 属正常)
  ok(`${code}: 无「仓库名称」残留`, !old)
  ok(`${code}: 「仓库」= 参照(WH)+必填(明细区)`, wh?.dataType === '参照' && (wh?.refPanel === 'WH' || wh?.ref?.panel === 'WH') && wh?.isRequired === true,
    JSON.stringify(wh ? { t: wh.dataType, r: wh.refPanel || wh?.ref?.panel, req: wh.isRequired } : null))
  const list = await post('/px/queryFormDataList', { panelCode: code, pageNo: 1, pageSize: 5, condition: {} })
  ok(`${code}: 列表可查`, Array.isArray(list?.list), `${list?.totalSize} 张`)
}
// 台账/状况表(视图三轮重建后)
const mv = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {} })
ok('库存台账可查', mv?.totalSize === 235, `totalSize=${mv?.totalSize}`)
const bal = await post('/px/queryFormDataList', { panelCode: 'STOCK_BALANCE', pageNo: 1, pageSize: 5, condition: {}, advFilters: [{ field: '仓库', op: 'notEmpty', value: '' }] })
ok('状况表 + notEmpty 仓库', bal?.totalSize === 84, `totalSize=${bal?.totalSize}`)
