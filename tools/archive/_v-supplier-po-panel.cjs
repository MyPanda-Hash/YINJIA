/**
 * _v-supplier-po-panel.cjs — 「供应商采购打印」独立面板验证(2026-10-25)
 *
 * 用户口径:「是多做一个和采购订单一样的供应商面版,只有打印按钮和查询
 *   (查询必须只能查供应商关联的数据)按钮的」。
 *
 * 断言:
 *   ① 面板存在且与采购订单结构一致(同一张表、字段数相同、关键列在位);
 *   ② 工具栏**只有 查询 + 打印**两组(供应商端与内部账号端都一样);
 *   ③ 供应商查询:服务端强制只回本供应商(前端不传/传别人的供应商都不影响);
 *   ④ 供应商不能查别的面板、不能调写接口(403);
 *   ⑤ 内部账号(admin)能进同一面板,看全量数据,同样只有 查询 + 打印。
 *
 * 用法:node tools/archive/_v-supplier-po-panel.cjs [baseUrl] [supplierUser] [supplierPass]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const SU = process.argv[3] || 'kbl01'
const SP = process.argv[4] || 'kbl@2026'
const PANEL = 'SUPPLIER_PU_ORDER'

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
async function call(path, { method = 'GET', token, body } = {}) {
  const r = await fetch(BASE + path.replace(/^\//, ''), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text()
  try { return JSON.parse(t) } catch (e) { return { raw: t, http: r.status } }
}
const login = async (u, p) => call('api/auth/login', { method: 'POST', body: { userName: u, password: p, factory: 'YJ' } })

async function main() {
  const at = (await login('admin', '123456')).data.token
  const st = (await login(SU, SP)).data
  check('供应商账号可登录', !!st.token)
  const t = st.token
  check('登录态 visiblePanels 只含本面板', JSON.stringify(st.user.visiblePanels) === JSON.stringify([PANEL]),
    JSON.stringify(st.user.visiblePanels))

  // ---------- ① 面板结构 ----------
  console.log('\n== ① 面板结构(与采购订单一致) ==')
  const cfg = await call(`api/px/getPanelConfig?panelCode=${PANEL}`, { token: t })
  check('供应商能读到本面板配置', cfg.code === 200, String(cfg.code))
  const cfgA = await call(`api/px/getPanelConfig?panelCode=PU_ORDER`, { token: at })
  const meta = cfg.data?.metadata || {}
  const metaA = cfgA.data?.metadata || {}
  check('面板名 = 供应商采购打印', String(meta.panelName || '').includes('供应商采购打印'), String(meta.panelName))
  const fields = (cfg.data?.dataSchema?.fields || []).length
  const fieldsA = (cfgA.data?.dataSchema?.fields || []).length
  // dataSchema.fields 是**表头**字段(85 列);明细行字段在明细页签里,故比对表头数相等即可
  check('表头字段数与采购订单一致', fields === fieldsA && fields >= 50, `本面板 ${fields} / 采购订单 ${fieldsA}`)
  // 工具栏只有 查询 + 打印
  const groups = (meta.buttonGroups || []).map((g) => g.name)
  const groupsA = (metaA.buttonGroups || []).map((g) => g.name)
  check('工具栏只有 查询 + 打印 两组', JSON.stringify(groups) === JSON.stringify(['查询', '打印']),
    `本面板=${groups.join(',')}`)
  check('采购订单原面板仍是完整按钮组(对照组)', groupsA.includes('新增') && groupsA.includes('保存'), groupsA.join(','))
  const printActs = ((meta.buttonGroups || []).find((g) => g.name === '打印') || {}).actions || []
  check('打印组含纸质单版式(打印采购订单/无金额/材料码)',
    printActs.includes('打印采购订单') && printActs.includes('打印订单无金额') && printActs.includes('打印材料码'),
    printActs.join('/'))

  // ---------- ② 供应商查询范围 ----------
  console.log('\n== ② 供应商查询:只能查到自己 ==')
  const me = st.user.supplierCode
  const q = async (condition) => call('api/px/queryFormDataList', {
    method: 'POST', token: t, body: { panelCode: PANEL, condition: condition || {}, pageNo: 1, pageSize: 300 },
  })
  const r1 = await q({})
  check('不传条件也能查(200)', r1.code === 200, String(r1.code))
  const rows = (r1.data && r1.data.list) || []
  const others = rows.filter((x) => String(x['供应商编码'] || '') !== me).length
  check('返回行全部属于本供应商', rows.length > 0 && others === 0, `共 ${rows.length} 行,越界 ${others} 行(本账号 ${me})`)
  const r2 = await q({ '供应商编码': 'NO-SUCH-SUPPLIER' })
  const rows2 = (r2.data && r2.data.list) || []
  check('前端硬塞别人的供应商无效(服务端覆盖)', rows2.length > 0 && rows2.every((x) => String(x['供应商编码'] || '') === me),
    `行数 ${rows2.length}`)
  // 门户接口口径对照
  const portal = await call('api/supplier/portal/orders?pageSize=1', { token: t })
  check('与门户接口总数一致', portal.data && portal.data.total === (r1.data && r1.data.totalSize),
    `门户 ${portal.data && portal.data.total} / 面板 ${r1.data && r1.data.totalSize}`)

  // ---------- ③ 越权 ----------
  console.log('\n== ③ 越权仍被挡 ==')
  const other = await call('api/px/queryFormDataList', { method: 'POST', token: t, body: { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 5 } })
  check('查采购订单原面板被拒', other.code === 403, String(other.code))
  const other2 = await call('api/px/queryFormDataList', { method: 'POST', token: t, body: { panelCode: 'SO_ORDER', condition: {}, pageNo: 1, pageSize: 5 } })
  check('查销售订单被拒', other2.code === 403, String(other2.code))
  const write = await call('api/px/callButton', { method: 'POST', token: t, body: { panelCode: PANEL, buttonName: '删除', formData: {} } })
  check('调写接口(callButton)被拒', write.code === 403, String(write.code))
  const desc = await call(`api/px/getFormDescriptor?panelCode=${PANEL}&code=X`, { token: t })
  check('取单据详情接口被拒(只读面板不给编辑态)', desc.code === 403, String(desc.code))

  // ---------- ④ 内部账号 ----------
  console.log('\n== ④ 内部账号(admin):同一面板、全量、同样只读 ==')
  const cfgAdm = await call(`api/px/getPanelConfig?panelCode=${PANEL}`, { token: at })
  const gAdm = ((cfgAdm.data?.metadata?.buttonGroups || [])).map((g) => g.name)
  check('内部账号看到的工具栏同样只有 查询 + 打印', JSON.stringify(gAdm) === JSON.stringify(['查询', '打印']), gAdm.join(','))
  const admQ = await call('api/px/queryFormDataList', { method: 'POST', token: at, body: { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 1 } })
  check('内部账号能查(全量)', admQ.code === 200 && (admQ.data?.totalSize || 0) > 0, `total=${admQ.data?.totalSize}`)
  check('内部账号看到的是全量(远大于单个供应商)', (admQ.data?.totalSize || 0) > rows.length,
    `全量 ${admQ.data?.totalSize} vs 供应商 ${rows.length}`)

  const pass = results.filter((r) => r.ok).length
  console.log(`\n=== 结果: ${pass}/${results.length} 通过 ===`)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
