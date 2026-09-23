// 收尾冒烟(2026-09-23):对 8090 新 jar 验证库存报表任务五个新路径
const BASE = 'http://localhost:8090/api'
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); if (!cond) process.exitCode = 1 }

const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const post = async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()).data
const cfg = await (await fetch(`${BASE}/px/getPanelConfig?panelCode=STOCK_BALANCE`, { headers: H })).json()

// ① 重算成本按钮已进库存三报表工具栏(PanelConfigService 增量)
const groups = cfg?.data?.metadata?.buttonGroups || []
const more = groups.find((g) => (g.actions || []).includes('表格调整'))
ok('① STOCK_BALANCE 更多组含「重算成本」', JSON.stringify(more?.actions || []).includes('重算成本'), JSON.stringify(more?.actions))

// ② 状况表 仓库/存货 查询字段=参照(WH/INV)
const qf = (cfg?.data?.metadata?.panelPageDto?.tablePages?.[0]?.queryFields || []).filter((f) => ['仓库', '存货'].includes(f.dataName))
ok('② 仓库/存货 均为参照', qf.length === 2 && qf.every((f) => f.dataType === '参照'), qf.map((f) => `${f.dataName}:${f.dataType}`).join(' '))

// ③ 高级筛选服务端化:contains 收窄 totalSize(前端链路新,PxController→QueryService)
const plain = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {} })
const filt = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {}, advFilters: [{ field: '存货', op: 'contains', value: '端盖' }] })
ok('③ advFilters contains 收窄 totalSize', filt.totalSize < plain.totalSize, `无筛选 ${plain.totalSize} → 含筛选 ${filt.totalSize}`)

// ④ 数值算子 gt + 未知字段容错(旧查询方案不炸)
const num = await post('/px/queryFormDataList', { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 5, condition: {}, advFilters: [{ field: '收入数量', op: 'gt', value: '0' }, { field: '已改名的旧字段', op: 'contains', value: 'x' }] })
ok('④ gt 数值比 + 未知字段跳过', typeof num.totalSize === 'number' && num.totalSize <= plain.totalSize, `totalSize=${num.totalSize}`)

// ⑤ 台账联动选项 = 档案∩有流水(回归:ButtonService 已提交口径)
const opts = await post('/px/callButton', { panelCode: 'STOCK_LEDGER', buttonName: '台账联动选项', formData: { 仓库: '', 存货: '' }, buttonParam: {} })
ok('⑤ 联动选项返回两列表', Array.isArray(opts?.['仓库列表']) && Array.isArray(opts?.['存货列表']), `仓 ${opts?.['仓库列表']?.length} 个 / 存货 ${opts?.['存货列表']?.length} 个` + (opts?.['仓库列表']?.length ? `(${opts['仓库列表'].slice(0, 3).join('、')}…)` : ''))

// ⑥ 重算成本按钮真跑(InvCostService 在新 jar 里 → 启动自检也应已执行)
const recalc = await post('/px/callButton', { panelCode: 'STOCK_BALANCE', buttonName: '重算成本', formData: {}, buttonParam: {} })
ok('⑥ 重算成本返回行数', typeof recalc?.['重算行数'] === 'number' && recalc['重算行数'] > 0, `重算行数=${recalc?.['重算行数']}`)

// ⑦ keyword 模糊搜索(报表面板弹窗新入口的后端依赖,回归)
const kw = await post('/px/queryFormDataList', { panelCode: 'STOCK_BALANCE', pageNo: 1, pageSize: 5, condition: {}, keyword: '端盖' })
ok('⑦ keyword 全字段 LIKE', typeof kw.totalSize === 'number', `totalSize=${kw.totalSize}`)
