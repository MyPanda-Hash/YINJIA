// 仓库收敛冒烟:采购入库字段集(仓库已无/仓库名称参照在)+ 台账三面版存活 + 查询可用
const BASE = 'http://localhost:8090/api'
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); if (!cond) process.exitCode = 1 }

const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const post = async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()).data
const get = async (p) => (await (await fetch(BASE + p, { headers: H })).json()).data

// ① 字段集:明细/表头/查询都不再有「仓库」;「仓库名称」= 参照(WH) 可见
const cfg = await get('/px/getPanelConfig?panelCode=PURCHASE_IN')
const fields = cfg?.metadata?.panelPageDto?.tablePages?.[0] || {}
const allFields = [...(fields.queryFields || []), ...(fields.headerFields || []), ...((cfg?.detail?.tabs || []).flatMap((t) => t.fields || []))]
const hasOld = allFields.some((f) => f.dataName === '仓库')
const whName = allFields.find((f) => f.dataName === '仓库名称')
ok('① 旧字段「仓库」已从面板消失', !hasOld)
ok('② 「仓库名称」= 参照(WH) 在列', whName?.dataType === '参照' && (whName?.refPanel === 'WH' || whName?.ref?.panel === 'WH'), JSON.stringify(whName ? { t: whName.dataType, r: whName.refPanel || whName.ref?.panel } : null))

// ② 列表可查(行模型不再含 仓库 键也不报错)
const list = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 5, condition: {} })
ok('③ 采购入库列表可查', Array.isArray(list?.list) && list.totalSize > 0, `${list?.totalSize} 张`)

// ③ 台账三面版(视图重建后)照常 + 收敛后的仓库过滤查询
const mv = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {} })
ok('④ 库存台账可查(视图重建后)', mv?.totalSize > 0, `totalSize=${mv?.totalSize}`)
const bal = await post('/px/queryFormDataList', { panelCode: 'STOCK_BALANCE', pageNo: 1, pageSize: 5, condition: {}, advFilters: [{ field: '仓库', op: 'notEmpty', value: '' }] })
ok('⑤ 状况表 + advFilters notEmpty 仓库存活', typeof bal?.totalSize === 'number', `totalSize=${bal?.totalSize}`)

// ④ 期初/期末合成行链路(台账三段式依赖 movement)抽查一条
const led = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 50, condition: {}, advFilters: [{ field: '存货', op: 'contains', value: '端盖' }] })
ok('⑥ 台账按存货过滤(端盖)', led?.totalSize > 0 && led.totalSize < mv.totalSize, `${mv.totalSize} → ${led.totalSize}`)
