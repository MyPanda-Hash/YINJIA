/**
 * 工序档案「工序编码唯一」取证脚本(2026-10-16)
 * ------------------------------------------------------------
 * 只打 8090 的 HTTP 接口,默认走**测试账套 YJ_TEST**(HSDZ_MES_TEST):
 *   ① OP 面板配置是否下发 metadata.uniqueKeys;
 *   ② 新增一行「编码已存在」→ 必须被服务端预检拦下(报业务话术,不是 SQL 原文);
 *   ③ 把已有行的编码改成另一行的编码 → 同样拦;
 *   ④ 正例:新增唯一编码 → 成功落库;
 *   ⑤ 作废该行后**同码可重建**(证明过滤唯一索引没把"作废行"算成占位);
 *   ⑥ 清理:作废本次造的两行,测试库回到干净状态。
 *
 * 用法: node tools/archive/_probe-op-dup/_op-unique-verify.mjs [--prod]
 *   --prod = 打正式账套(YJ):**只读**(不打②~⑥的写用例,避免污染正式库)。
 */
const BASE = 'http://127.0.0.1:8090'
const PROD = process.argv.includes('--prod')
const FACTORY = PROD ? 'YJ' : 'YJ_TEST'
const fail = []
const ok = (cond, msg, extra) => {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}${extra ? ' :: ' + extra : ''}`)
  if (!cond) fail.push(msg)
}

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON */ }
  return { http: res.status, json, text }
}

const login = await call('POST', '/api/auth/login', { userName: 'admin', password: '123456', factory: FACTORY })
const token = login.json?.data?.token
if (!token) { console.error('登录失败:', login.text.slice(0, 300)); process.exit(1) }
console.log(`[1] 登录 ${FACTORY} OK`)

const cfg = await call('GET', `/api/px/getPanelConfig?panelCode=OP`, null, token)
const uniqueKeys = cfg.json?.data?.metadata?.uniqueKeys
console.log('[2] 面板配置 metadata.uniqueKeys =', JSON.stringify(uniqueKeys))
ok(JSON.stringify(uniqueKeys) === '[["工序编码"]]', 'OP 面板下发 uniqueKeys=[["工序编码"]]')

const q = await call('POST', '/api/px/queryFormDataList', { panelCode: 'OP', condition: {}, pageNo: 1, pageSize: 100 }, token)
const doc = q.json?.data?.list?.[0]
const rows = doc?.detail?.op || doc?.detail?.items || []
console.log(`[3] 工序档案现有存活行 ${rows.length} 行:` + rows.map((r) => `${r.id}:${r['工序编码']}/${r['工序名称']}`).join(' '))
ok(new Set(rows.map((r) => r['工序编码'])).size === rows.length, '存活行 工序编码 无重复')

if (PROD) {
  console.log('\n[--prod] 正式账套只做只读核对,写用例跳过')
} else {
  const head = { 编号: doc?.['编号'], 状态: doc?.['状态'] || '启用' }
  const save = (list, extra = {}) => call('POST', '/api/px/callButton', {
    panelCode: 'OP', buttonName: '保存',
    formData: { ...head, ...extra, detail: { op: list } },
    buttonParam: { 只提交改动行: true },
  }, token)

  const existing = rows.find((r) => r['工序编码'] === 'OP-HL') || rows[0]
  console.log(`\n[4] 用例:新增一行,编码取已存在的「${existing['工序编码']}」`)
  const dupNew = await save([{ 工序编码: existing['工序编码'], 工序名称: '重复校验用例-不应落库' }])
  const dupMsg = dupNew.json?.message || dupNew.text
  ok(dupNew.http !== 200 && String(dupMsg).includes('不允许重复'), '新增同码被拦下', `http=${dupNew.http} msg=${dupMsg}`)

  const other = rows.find((r) => r['工序编码'] !== existing['工序编码'])
  if (other) {
    console.log(`[5] 用例:把 id=${other.id} 的编码改成「${existing['工序编码']}」`)
    const dupEdit = await save([{ id: other.id, 工序编码: existing['工序编码'], 工序名称: other['工序名称'] }])
    ok(dupEdit.http !== 200 && String(dupEdit.json?.message || '').includes('不允许重复'),
      '改动行撞码被拦下', `http=${dupEdit.http} msg=${dupEdit.json?.message}`)
  }

  console.log('[6] 用例:新增唯一编码 ZZ-TST-1')
  const create = await save([{ 工序编码: 'ZZ-TST-1', 工序名称: '唯一性验证-临时行' }])
  ok(create.http === 200, '唯一编码新增成功', `http=${create.http} ${JSON.stringify(create.json?.data)}`)

  const q2 = await call('POST', '/api/px/queryFormDataList', { panelCode: 'OP', condition: {}, pageNo: 1, pageSize: 100 }, token)
  const rows2 = q2.json?.data?.list?.[0]?.detail?.op || []
  const tmp = rows2.find((r) => r['工序编码'] === 'ZZ-TST-1')
  ok(!!tmp, '新行已落库', `id=${tmp?.id}`)
  ok(rows2.filter((r) => r['工序编码'] === 'ZZ-TST-1').length === 1, '库里该编码恰好 1 行')

  if (tmp) {
    console.log('[7] 用例:作废该行后,同码再建一次')
    const del = await save([], { 作废行id: [tmp.id] })
    ok(del.http === 200, '作废成功', `http=${del.http}`)
    const again = await save([{ 工序编码: 'ZZ-TST-1', 工序名称: '唯一性验证-重建行' }])
    ok(again.http === 200, '作废后同码可重建(作废行不占码)', `http=${again.http} ${again.json?.message || ''}`)

    console.log('[8] 清理:作废本次重建的行')
    const q3 = await call('POST', '/api/px/queryFormDataList', { panelCode: 'OP', condition: {}, pageNo: 1, pageSize: 100 }, token)
    const rows3 = q3.json?.data?.list?.[0]?.detail?.op || []
    const leftovers = rows3.filter((r) => r['工序编码'] === 'ZZ-TST-1')
    const clean = await save([], { 作废行id: leftovers.map((r) => r.id) })
    ok(clean.http === 200, '清理成功', `作废 ${leftovers.length} 行`)
    const q4 = await call('POST', '/api/px/queryFormDataList', { panelCode: 'OP', condition: {}, pageNo: 1, pageSize: 100 }, token)
    const rows4 = q4.json?.data?.list?.[0]?.detail?.op || []
    ok(!rows4.some((r) => r['工序编码'] === 'ZZ-TST-1'), '测试库已回到干净状态(无 ZZ-TST-1 存活行)')
  }
}

console.log(`\n==== ${fail.length ? 'FAIL ' + fail.length + ' 项' : 'PASS 全部通过'} ====`)
if (fail.length) { fail.forEach((f) => console.log('  - ' + f)); process.exit(1) }
