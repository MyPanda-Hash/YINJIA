// 动态字段(备用列池)验收探针 —— 用法: node tools/verify/ext-field-test.cjs [baseUrl]
// 断言:总览结构/绑定生效/重复409/非法字符400/类型白名单/下拉词表/G6拒退绑/退绑重绑恢复/无令牌403。
// 探针自清理:结束时退绑全部 EXT_ 测试字段;残留判定:面板配置里无 EXT_ 前缀标签。
// ⚠ 后端类级映射是 /api/px(request.js 的 baseURL=/api 只是前端侧约定),裸调必须带 /api 前缀。
const base = process.argv[2] || 'http://127.0.0.1:8090'
let pass = 0, fail = 0, token = ''
const ok = (name, cond, extra = '') => { (cond ? (pass++, console.log('  ok -', name)) : (fail++, console.log('  FAIL -', name, extra))) }
const PANEL = process.env.EXT_PANEL || 'PARTNER' // bs_partner 档案面板(archive,detail 绑定)
async function api(method, path, body, useToken = true) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(useToken && token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let j = null
  try { j = await res.json() } catch {}
  return { status: res.status, body: j }
}
;(async () => {
  const login = await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' }, false)
  token = login.body?.data?.token
  ok('admin 登录', !!token)
  const LABEL = 'EXT_测试字段' + Date.now().toString(36).slice(-4)
  // 1. 总览
  let r = await api('GET', '/api/px/extFields?panel=' + PANEL)
  ok('GET /api/px/extFields 200', r.status === 200, JSON.stringify(r.body))
  const ov = r.body?.data || {}
  ok('总览含 capacity=20 与 linePool', ov.capacity === 20 && Array.isArray(ov.linePool) && ov.linePool.length === 20)
  ok('linePool 首列是 备用1 且带 dirtyRows', ov.linePool[0]?.col === '备用1' && typeof ov.linePool[0]?.dirtyRows === 'number')
  // 2. 绑定(文本,进查询区)
  r = await api('POST', '/api/px/extField/add', { panel: PANEL, label: LABEL, labelEn: 'Ext Test Field', dataType: '文本', place: 'detail', inQuery: true, width: 120, required: false })
  ok('add 绑定 200 且返回备用列', r.status === 200 && /^备用\d+$/.test(r.body?.data?.colName || ''), JSON.stringify(r.body))
  // 3. 面板配置立即出现新字段(缓存已 reload)
  const cfg = await api('GET', '/api/px/getPanelConfig?panelCode=' + PANEL)
  const flat = JSON.stringify(cfg.body?.data || {})
  ok('面板配置含新字段标签', flat.includes(LABEL))
  // 4. G2 重复 → 409
  r = await api('POST', '/api/px/extField/add', { panel: PANEL, label: LABEL, labelEn: 'x', dataType: '文本', place: 'detail', inQuery: false })
  ok('G2 重复标签 409', r.status === 409, r.status + '')
  // 5. G1 非法字符 → 400
  for (const bad of ['a.b', '税率%', '有 空格', '括(号']) {
    r = await api('POST', '/api/px/extField/add', { panel: PANEL, label: bad, labelEn: 'x', dataType: '文本', place: 'detail', inQuery: false })
    ok('G1 非法标签 400: ' + bad, r.status === 400, r.status + '')
  }
  // 6. 类型白名单外 → 400
  r = await api('POST', '/api/px/extField/add', { panel: PANEL, label: 'EXT_x' + Date.now(), labelEn: 'x', dataType: '小数', place: 'detail', inQuery: false })
  ok('类型白名单(小数) 400', r.status === 400, r.status + '')
  // 7. 下拉框词表 → 绑定成功(dict_sql VALUES 形态由界面消费验证)
  //    ⚠ 名字不能包含 LABEL 作子串:断言用 includes,子串会造成退绑误报(2026-09-28 实测踩到)
  const LBL2 = 'EXT_词表' + Date.now().toString(36).slice(-4)
  r = await api('POST', '/api/px/extField/add', { panel: PANEL, label: LBL2, labelEn: 'Ext Sel', dataType: '下拉框', dictOptions: '是,否,待定', place: 'detail', inQuery: false })
  ok('下拉框绑定 200', r.status === 200, JSON.stringify(r.body))
  // 8. G6 非法 fieldId → 400
  r = await api('POST', '/api/px/extField/retire', { panel: PANEL, fieldId: -1 })
  ok('G6 非法 fieldId 400', r.status === 400, r.status + '')
  // 9. 退绑 → 配置里消失 → 重绑恢复
  const fields = (await api('GET', '/api/px/extFields?panel=' + PANEL)).body?.data?.fields || []
  const fid = fields.find(f => f.label === LABEL)?.id
  r = await api('POST', '/api/px/extField/retire', { panel: PANEL, fieldId: fid })
  ok('retire 200', r.status === 200, r.status + '')
  let cfg2 = JSON.stringify((await api('GET', '/api/px/getPanelConfig?panelCode=' + PANEL)).body?.data || {})
  ok('退绑后配置无该标签', !cfg2.includes(LABEL))
  r = await api('POST', '/api/px/extField/add', { panel: PANEL, label: LABEL, labelEn: 'Ext Test Field', dataType: '文本', place: 'detail', inQuery: true, width: 120, required: false })
  ok('重绑 200(恢复显示)', r.status === 200, r.status + '')
  // 10. 清理:退绑两个测试字段
  const f2 = (await api('GET', '/api/px/extFields?panel=' + PANEL)).body?.data?.fields || []
  for (const f of f2.filter(x => x.label.startsWith('EXT_'))) await api('POST', '/api/px/extField/retire', { panel: PANEL, fieldId: f.id })
  cfg2 = JSON.stringify((await api('GET', '/api/px/getPanelConfig?panelCode=' + PANEL)).body?.data || {})
  ok('清理完成(配置无 EXT_ 残留)', !cfg2.includes('EXT_'))
  // 11. 无 token → 403
  const saved = token; token = ''
  r = await api('POST', '/api/px/extField/add', { panel: PANEL, label: 'EXT_noauth', labelEn: 'x', dataType: '文本', place: 'detail', inQuery: false })
  ok('无令牌 403', r.status === 403, r.status + '')
  token = saved
  console.log(`\n结果: pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('FATAL', e); process.exit(2) })
