/**
 * 组装物料清单(ASM_BOM)表头可维护 —— 临时并行实例(8091,新代码)上的 API 级真实验证(一次性探针,2026-11-04)。
 *
 * 为什么是 8091:本机运行的 8090 实例属**宿主另一会话**,agent 无权重启/换 jar;
 * 为了验证「表头可填 + 保存以表头为准 + 连加两行行序不撞索引 + 新增 BOM 可建」这套代码改动,
 * 用同一份工作区源码另外打了一个 jar 起在 8091(库仍是本机 HSDZ_MES / HSDZ_MES_TEST),只写**测试账套**。
 *
 * 断言:见 CHECKS 数组;输出 PASS/FAIL 行 + RESULT 行,退出码 0=全 PASS。
 * 清理:新增测试单调用「删除」软删;调用方随后用 cleanup-e2e.sql 硬删测试账套里的 E2E 单,避免留垃圾。
 *
 * 用法:node tools\archive\_asm-bom-maintainable-verify-20261104\_ApiVerify.mjs [baseUrl]
 *   baseUrl 缺省 http://127.0.0.1:8091
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const PANEL = 'ASM_BOM'
const results = []
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

let token = ''
async function api(method, path, body) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const raw = await res.text()
  let json = null
  try { json = JSON.parse(raw) } catch { /* 非 JSON 原样带出 */ }
  if (!res.ok) throw new Error(`${method} ${path} HTTP ${res.status}: ${raw.slice(0, 400)}`)
  if (json && json.code !== undefined && json.code !== 200) throw new Error(`${method} ${path} code=${json.code}: ${json.message || raw.slice(0, 300)}`)
  return json
}
const callButton = async (buttonName, formData = {}, buttonParam = {}) =>
  (await api('POST', '/px/callButton', { panelCode: PANEL, buttonName, formData, buttonParam })).data
const listDocs = async (condition = {}, pageSize = 300) =>
  (await api('POST', '/px/queryFormDataList', { panelCode: PANEL, condition, pageNo: 1, pageSize })).data
const findDoc = async (no) => (await listDocs({ 单据编号: no })).list.find((d) => (d['编号'] || d['单据编号']) === no)

/** 当前单 → 保存载荷(与前端 currentFormData 同构:head 展开 + detail.items) */
function payloadOf(doc, headOverride = {}, itemsOverride = undefined) {
  const head = {}
  for (const [k, v] of Object.entries(doc)) if (k !== 'detail') head[k] = v
  Object.assign(head, headOverride)
  return { ...head, detail: { items: itemsOverride ?? (doc.detail?.items || []) } }
}
const labelOf = (f) => f.dataName || f.label
const fieldMap = (fields) => Object.fromEntries((fields || []).map((f) => [labelOf(f), f]))

async function main() {
  // ── 0. 登录测试账套(所有写操作只在 HSDZ_MES_TEST) ──
  const login = (await api('POST', '/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })).data
  token = login.token
  check('登录测试账套', !!token, `factory=${login.user?.factory}`)

  // ── 1. 元数据:表头 8 个字段可编辑、3 个仍只读、参照/下拉/默认值就位 ──
  const cfg = (await api('GET', `/px/getPanelConfig?panelCode=${PANEL}`)).data
  const hdr = fieldMap(cfg.dataSchema?.fields)
  const det = fieldMap(cfg.detail?.tabs?.[0]?.fields)
  const EDITABLE = ['产品编码', '产品名称', '规格型号', '工序', '版本号', '默认BOM', '工艺路线名称', '备注']
  const LOCKED = ['单据编号', '来源', '状态']
  const badEdit = EDITABLE.filter((k) => !hdr[k] || hdr[k].readonly === true)
  check('表头 8 字段均不再是 readonly(表头可填写)', badEdit.length === 0, badEdit.length ? '仍只读: ' + badEdit.join(',') : EDITABLE.join(','))
  const badLock = LOCKED.filter((k) => hdr[k] && hdr[k].readonly !== true)
  check('单据编号/来源/状态 仍保持只读', badLock.length === 0, badLock.length ? '被误开: ' + badLock.join(',') : '')
  check('产品编码 参照 INV(存货编码→存货名称)',
    hdr['产品编码']?.refPanel === 'INV' && hdr['产品编码']?.refField === '存货编码' && hdr['产品编码']?.displayField === '存货名称',
    JSON.stringify({ refPanel: hdr['产品编码']?.refPanel, refField: hdr['产品编码']?.refField, displayField: hdr['产品编码']?.displayField }))
  const prodMap = (hdr['产品编码']?.refMap || []).map((m) => m.from + '→' + m.to)
  check('选产品编码会带回 产品名称/规格型号', prodMap.includes('存货名称→产品名称') && prodMap.includes('规格型号→规格型号'), prodMap.join(','))
  check('子件编码 明细参照 INV', det['子件编码']?.refPanel === 'INV' && det['子件编码']?.refField === '存货编码', JSON.stringify({ refPanel: det['子件编码']?.refPanel }))
  const subMap = (det['子件编码']?.refMap || []).map((m) => m.from + '→' + m.to)
  check('选子件编码会带回 子件名称/子件规格/计量单位',
    subMap.includes('存货名称→子件名称') && subMap.includes('规格型号→子件规格') && subMap.includes('计量单位→计量单位'), subMap.join(','))
  const bomOpts = (hdr['默认BOM']?.options || []).map((o) => (typeof o === 'string' ? o : o.value))
  check('默认BOM 为下拉(是/否)', bomOpts.includes('是') && bomOpts.includes('否'), JSON.stringify(bomOpts))
  check('新建默认值 状态=启用 已下发', cfg.metadata?.headDefaults?.['状态'] === '启用', JSON.stringify(cfg.metadata?.headDefaults || null))

  // ── 2. 挑一张既有单做「表头改了能存住」验证 ──
  const docs = (await listDocs({}, 300)).list
  const target = docs.find((d) => d.detail?.items?.length >= 1)
  if (!target) throw new Error('测试账套里没有可用的 ASM_BOM 单据,无法继续')
  const targetNo = target['编号'] || target['单据编号']
  const orig = { 备注: target['备注'] ?? '', 版本号: target['版本号'] ?? '', 工艺路线名称: target['工艺路线名称'] ?? '' }
  log('目标单', targetNo, '行数', target.detail.items.length, '原备注', JSON.stringify(orig.备注))
  const marker = 'E2E-HEADER-' + Date.now()
  await callButton('提交', payloadOf(target, { 备注: marker, 版本号: 'E2E-V2' }))
  let after = await findDoc(targetNo)
  check('表头编辑保存后落库(备注/版本号)', after['备注'] === marker && after['版本号'] === 'E2E-V2',
    `备注=${JSON.stringify(after['备注'])} 版本号=${JSON.stringify(after['版本号'])}`)
  check('表头未改字段未被行内旧值冲掉(产品编码/工序/产品名称)',
    after['产品编码'] === target['产品编码'] && after['工序'] === target['工序'] && after['产品名称'] === target['产品名称'],
    `产品编码=${after['产品编码']} 工序=${after['工序']}`)

  // ── 3. 连加两行(前端新行 行序=0)保存,验证服务端补号不撞唯一索引 ──
  const baseItems = after.detail.items.map((r) => ({ ...r }))
  const addItems = [
    { 子件编码: baseItems[0]?.['子件编码'] || 'E2E-SUB-1', 子件名称: 'E2E临时子件A', 标准用量: 1, 损耗量: 0, 行序: 0, 行备注: 'E2E-ROW-A' },
    { 子件编码: baseItems[0]?.['子件编码'] || 'E2E-SUB-1', 子件名称: 'E2E临时子件B', 标准用量: 2, 损耗量: 0, 行序: 0, 行备注: 'E2E-ROW-B' },
  ]
  await callButton('提交', payloadOf(after, {}, [...baseItems, ...addItems]))
  after = await findDoc(targetNo)
  const e2eRows = (after.detail?.items || []).filter((r) => String(r['行备注'] || '').startsWith('E2E-ROW-'))
  const seqs = e2eRows.map((r) => Number(r['行序']))
  check('连加两行保存成功且行序不撞唯一索引', e2eRows.length === 2 && new Set(seqs).size === 2,
    `新增行数=${e2eRows.length} 行序=${JSON.stringify(seqs)}`)
  const allSeqs = (after.detail?.items || []).map((r) => Number(r['行序']))
  check('同单全部行序互不重复', new Set(allSeqs).size === allSeqs.length, JSON.stringify(allSeqs))

  // ── 4. 新增一张 BOM(空白草稿→填表头+两行→保存),验证「新增」可用且表头落库 ──
  const created = await callButton('提交', {})
  const newNo = created['编号'] || created.formNo
  check('新增可建出空白草稿单(编号自动 BOM-… 或返回编号)', !!newNo, JSON.stringify(created))
  const newDoc = await findDoc(newNo)
  const productCode = target['产品编码']
  const newPay = {
    编号: newNo,
    产品编码: productCode,
    产品名称: target['产品名称'],
    规格型号: target['规格型号'],
    工序: '组装',
    版本号: 'E2E-NEW-V1',
    默认BOM: '否',
    工艺路线名称: target['工艺路线名称'],
    备注: 'E2E-NEW-DOC',
    detail: {
      items: [
        { 子件编码: baseItems[0]?.['子件编码'] || 'E2E-SUB-1', 子件名称: 'E2E新单子件A', 计量单位: '支', 标准用量: 1, 损耗量: 0, 行序: 0, 行备注: 'E2E-NEW-A' },
        { 子件编码: 'YJ-KBL-012', 子件名称: 'E2E新单子件B', 计量单位: '个', 标准用量: 0.005, 损耗量: 0, 行序: 0, 行备注: 'E2E-NEW-B' },
      ],
    },
  }
  await callButton('提交', newPay)
  const newAfter = await findDoc(newNo)
  check('新单表头保存落库(产品编码/工序/版本号/备注)',
    newAfter['产品编码'] === productCode && newAfter['工序'] === '组装' && newAfter['版本号'] === 'E2E-NEW-V1' && newAfter['备注'] === 'E2E-NEW-DOC',
    `产品编码=${newAfter['产品编码']} 工序=${newAfter['工序']} 版本号=${newAfter['版本号']} 备注=${newAfter['备注']}`)
  const newRows = newAfter.detail?.items || []
  const newSeqs = newRows.map((r) => Number(r['行序']))
  check('新单两行子件都在且行序互不重复', newRows.length === 2 && new Set(newSeqs).size === 2, `行=${newRows.length} 行序=${JSON.stringify(newSeqs)}`)
  check('新单两张子件行内容正确', newRows.some((r) => r['子件编码'] === 'YJ-KBL-012') && newRows.some((r) => String(r['子件名称']).includes('E2E新单子件A')), JSON.stringify(newRows.map((r) => [r['子件编码'], r['行序']])))

  // ── 5. 清理:还原既有单(表头版本号回原值 + 去掉 E2E 行),删除新单 ──
  // ⚠ 已知口径(框架级,非本次改动):headWins 保存链「空值不覆盖已有值」⇒ **表头格清空(置空)不生效**。
  //   本例原始 备注 为空,故 E2E 标记只能由 cleanup-e2e.sql 的 SQL 兜底清掉(脚本结束会提示)。
  const restore = payloadOf(await findDoc(targetNo), orig, (await findDoc(targetNo)).detail.items.filter((r) => !String(r['行备注'] || '').startsWith('E2E-ROW-')))
  await callButton('提交', restore)
  await callButton('删除', { 编号: newNo })
  const restored = await findDoc(targetNo)
  check('既有单 E2E 行已作废(明细列表不再可见)',
    (restored.detail?.items || []).every((r) => !String(r['行备注'] || '').startsWith('E2E-ROW-')),
    `行数=${restored.detail?.items?.length}`)
  check('既有单版本号已回原值', (restored['版本号'] ?? '') === orig.版本号, `版本号=${JSON.stringify(restored['版本号'])} 原值=${JSON.stringify(orig.版本号)}`)
  if (String(restored['备注'] || '').startsWith('E2E-')) {
    log('提示:表头备注仍留 E2E 标记 —— headWins 不支持清空表头格(原值为空),结束请执行 cleanup-e2e.sql 兜底')
  }
  const deleted = (await listDocs({ 单据编号: newNo })).list.filter((d) => (d['编号'] || d['单据编号']) === newNo)
  check('新单已删除(软删后列表不可见)', deleted.length === 0, `剩余=${deleted.length}`)

  // ── 汇总 ──
  const fails = results.filter((r) => !r.ok)
  console.log(`\nRESULT: ${fails.length === 0 ? 'PASS' : 'FAIL'} (${results.length - fails.length}/${results.length})`)
  if (fails.length) console.log('FAILED: ' + fails.map((f) => f.name).join(' | '))
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => {
  console.error('[FATAL]', e.message)
  const fails = results.filter((r) => !r.ok)
  console.log(`\nRESULT: FAIL (${results.length - fails.length}/${results.length})`)
  process.exit(1)
})
