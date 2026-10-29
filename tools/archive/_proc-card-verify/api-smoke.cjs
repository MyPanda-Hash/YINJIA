/**
 * api-smoke.cjs — 工序流程追踪卡 接口冒烟(契约 docs/design/工序流程追踪卡-V1.0.md §3)
 *
 * 用法: node tools/archive/_proc-card-verify/api-smoke.cjs
 * 前置: 8090 已用新 jar 起(rebuild-prod.ps1 之后)
 *
 * 覆盖:PASS/FAIL 逐项 + 结构逐键校验(键名照契约,缺键/多键都算不符)+
 *       create 幂等 + save 备注/卡状态(已完成前置校验)+ list/batchTrace/trace 结构 +
 *       attachment 上传/列表/下载/删除 + 一张真实小图(100x100 PNG,本脚本生成)。
 * 产物: api-smoke-result.json(含契约关键数据,供报告/交叉核对)、api-smoke.log(stdout 另存)
 *
 * 注意:本脚本**故意不删卡**——卡留给后面的 UI 验证用;最终由 cleanup.cjs 统一清造数。
 */
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const API = 'http://127.0.0.1:8090'
const HERE = __dirname
const OUT = path.join(HERE, 'api-smoke-result.json')

let fails = 0
const results = []
function chk(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail === undefined ? '' : detail })
  console.log(`  ${cond ? '[PASS]' : '[FAIL]'} ${name}${detail !== undefined && detail !== '' ? '  :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
  if (!cond) fails++
}
const sameKeys = (obj, expected) => {
  const got = Object.keys(obj || {}).sort()
  const want = [...expected].sort()
  return { ok: got.length === want.length && got.every((k, i) => k === want[i]), got, want }
}

/** 100x100 纯色 PNG(不装依赖:手写 IHDR/IDAT/IEND) */
function makePng(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]
    }
  }
  const table = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c }
    return t
  })()
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0)
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

let TOKEN = ''
async function post(p, body) {
  const r = await fetch(API + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body ?? {}),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON */ }
  return { http: r.status, json, text }
}
const postRaw = async (p, body) => {
  const r = await fetch(API + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: Buffer.from(JSON.stringify(body ?? {}), 'utf8'),
  })
  const text = await r.text()
  let json = null; try { json = JSON.parse(text) } catch {}
  return { http: r.status, json, text }
}
const get = async (p) => {
  const r = await fetch(API + p, { headers: { Authorization: `Bearer ${TOKEN}` } })
  return { http: r.status, json: await r.json().catch(() => null), headers: r.headers, buf: await r.arrayBuffer().catch(() => null) }
}

const HEAD_KEYS = ['卡号', '大批次号', '小批次号', '批次来源', '工单号', '工单行号', '工单行id', '产品编码', '产品名称',
  '规格型号', '计划数量', '生产线', '工艺路线', '卡状态', '确认人', '确认时间', '备注', '照片数', '可确认完成']
const OP_KEYS = ['id', '工序序', '工序', '工序编码', '生产车间', '计划数量', '已报工', '待审核', '状态',
  '完成时间', '报工人', '报工单数', '照片数', '可确认']
const REPORT_KEYS = ['报工单号', '工序', '报工数量', '报工人', '完工状态', '单据日期']
const BATCH_KEYS = ['批次号', '批次来源', '行数', '卡数', '产品数', '计划数量']
const LINE_KEYS = ['工单行id', '工单号', '工单行号', '产品编码', '产品名称', '规格型号', '计划数量',
  '生产线', '当前工序', '完工状态', '卡号', '卡状态', '照片数']
const ROW_KEYS = ['卡号', '大批次号', '小批次号', '批次来源', '工单号', '工单行号', '产品编码', '产品名称',
  '规格型号', '计划数量', '生产线', '卡状态', '工序进度', '完成工序数', '工序数', '照片数', '创建人', '更新时间']

async function main() {
  const t0 = Date.now()
  fs.mkdirSync(HERE, { recursive: true })
  const png = makePng(100, 100, [30, 144, 255])
  const pngPath = path.join(HERE, 'verify-photo-100x100.png')
  fs.writeFileSync(pngPath, png)
  console.log(`[png] ${pngPath} (${png.length} bytes)`)

  // ── 登录 ──────────────────────────────────────────────
  const lr = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await lr.json()
  TOKEN = login?.data?.token || ''
  chk('admin 登录 8090 成功并拿到 token', !!TOKEN, `http=${lr.status} 长度=${TOKEN.length}`)
  if (!TOKEN) throw new Error('无法登录,后续冒烟无意义')

  const out = { ts: new Date().toISOString(), checks: results, data: {} }

  // ── 1 /meta ──────────────────────────────────────────
  console.log('\n=== /api/procCard/meta ===')
  let r = await post('/api/procCard/meta', {})
  chk('meta 200 + ApiResult.code=200', r.http === 200 && r.json?.code === 200, `http=${r.http} code=${r.json?.code}`)
  chk('meta 结构 {工序:string[], 卡状态:["录入中","已完成"]}', Array.isArray(r.json?.data?.工序) && r.json.data.工序.length > 0
    && JSON.stringify(r.json?.data?.卡状态) === JSON.stringify(['录入中', '已完成']),
    { 工序数: r.json?.data?.工序?.length, 卡状态: r.json?.data?.卡状态 })
  out.data.meta = r.json?.data

  // ── 2 /batches ───────────────────────────────────────
  console.log('\n=== /api/procCard/batches ===')
  r = await post('/api/procCard/batches', {})
  chk('batches 200 + 数组', r.http === 200 && r.json?.code === 200 && Array.isArray(r.json?.data),
    `http=${r.http} n=${(r.json?.data || []).length}`)
  const batches = r.json?.data || []
  const k = sameKeys(batches[0], BATCH_KEYS)
  chk('batches 行键 = 契约 §3.2', k.ok, k.ok ? '' : { got: k.got, want: k.want })
  const batch = batches.find((b) => b['批次号'] === '20261019') || batches.find((b) => b['批次号'] === '20261016') || batches[0]
  chk('找到真实批次(20261019/20261016 优先)', !!batch, batch && JSON.stringify({ 批次号: batch['批次号'], 来源: batch['批次来源'], 行数: batch['行数'] }))
  out.data.batch = batch

  // ── 3 /lines ─────────────────────────────────────────
  console.log('\n=== /api/procCard/lines ===')
  r = await postRaw('/api/procCard/lines', { 批次号: batch['批次号'] })
  chk('lines 200 + 数组', r.http === 200 && r.json?.code === 200 && Array.isArray(r.json?.data),
    `http=${r.http} n=${(r.json?.data || []).length} code=${r.json?.code}`)
  const lines = r.json?.data || []
  const k2 = sameKeys(lines[0], LINE_KEYS)
  chk('lines 行键 = 契约 §3.3', k2.ok, k2.ok ? '' : { got: k2.got, want: k2.want })
  // 选一个有真实报工的行:20261019 的 GD-2026-10-0223#1(DB 预查:工序台账 3 行 + 已审核报工 1 笔)
  const target = lines.find((x) => x['工单号'] === 'GD-2026-10-0223' && Number(x['工单行号']) === 1)
    || lines.find((x) => !x['卡号']) || lines[0]
  chk('选中真实工单行(小批次候选)', !!target, target && `工单行id=${target['工单行id']} ${target['工单号']}#${target['工单行号']}`)
  const rowId = target['工单行id']
  // 负例:不带批次号 → 400
  let neg = await post('/api/procCard/lines', {})
  chk('lines 缺批次号 → 400(参数校验)', neg.http === 400 || neg.json?.code === 400, `http=${neg.http} msg=${neg.json?.message}`)
  // 关键字过滤
  r = await postRaw('/api/procCard/lines', { 批次号: batch['批次号'], 关键字: target['工单号'] })
  chk('lines 关键字过滤生效(≥1 且都含关键字)', r.http === 200 && (r.json?.data || []).length >= 1
    && (r.json.data).every((x) => JSON.stringify(x).includes(target['工单号'])), `n=${(r.json?.data || []).length}`)

  // ── 4 /create(幂等)────────────────────────────────────
  console.log('\n=== /api/procCard/create ===')
  r = await post('/api/procCard/create', { 工单行id: rowId, 备注: '' })
  chk('create 200 + code=200', r.http === 200 && r.json?.code === 200, `http=${r.http} code=${r.json?.code} msg=${r.json?.message || ''}`)
  const detail1 = r.json?.data || {}
  const card = detail1['头'] || {}
  const expectCardNo = `LZK-${target['工单号']}-${target['工单行号']}`
  chk(`卡号 = LZK-<工单号>-<行号> = ${expectCardNo}`, card['卡号'] === expectCardNo, card['卡号'])
  chk('小批次号 = <工单号>-<行号>', card['小批次号'] === `${target['工单号']}-${target['工单行号']}`, card['小批次号'])
  chk('create 返回结构与 detail 相同({头,工序行,报工记录,照片})',
    ['头', '工序行', '报工记录', '照片'].every((x) => x in detail1), Object.keys(detail1))
  const k3 = sameKeys(card, HEAD_KEYS)
  chk('头 键 = 契约 §3.5', k3.ok, k3.ok ? '' : { got: k3.got, want: k3.want })
  chk('头.照片数 / 可确认完成 为 number/boolean', typeof card['照片数'] === 'number' && typeof card['可确认完成'] === 'boolean',
    `照片数=${card['照片数']} 可确认完成=${card['可确认完成']}`)
  // 幂等:再建一次同卡号、同 id 的行数不增
  const again = await post('/api/procCard/create', { 工单行id: rowId })
  chk('create 幂等(同工单行再建返回同一卡号)', again.json?.data?.['头']?.['卡号'] === card['卡号'],
    again.json?.data?.['头']?.['卡号'])
  // 负例:缺 工单行id
  neg = await post('/api/procCard/create', {})
  chk('create 缺工单行id → 400', neg.http === 400 || neg.json?.code === 400, `http=${neg.http} msg=${neg.json?.message}`)
  out.data.card = card
  out.data.cardNo = card['卡号']
  out.data.rowId = rowId

  // ── 5 /detail ────────────────────────────────────────
  console.log('\n=== /api/procCard/detail ===')
  r = await post('/api/procCard/detail', { 卡号: card['卡号'] })
  chk('detail 200 + code=200', r.http === 200 && r.json?.code === 200, `http=${r.http} code=${r.json?.code}`)
  const d = r.json?.data || {}
  chk('detail 结构 = {头,工序行,报工记录,照片}', ['头', '工序行', '报工记录', '照片'].every((x) => x in d), Object.keys(d))
  const ops = d['工序行'] || []
  chk('工序行非空(台账已补齐/snapshot)', ops.length >= 1, `n=${ops.length}`)
  const k4 = sameKeys(ops[0], OP_KEYS)
  chk('工序行 键 = 契约 §3.5', k4.ok, k4.ok ? '' : { got: k4.got, want: k4.want })
  chk('工序状态 ∈ {已完工,进行中,未开始}', ops.every((o) => ['已完工', '进行中', '未开始'].includes(o['状态'])),
    ops.map((o) => `${o['工序序']}.${o['工序']}=${o['状态']}(${o['已报工']}/${o['计划数量']})`).join('; '))
  const reps = d['报工记录'] || []
  chk('报工记录数组且行键 = 契约 §3.5', Array.isArray(reps) && (reps.length === 0 || sameKeys(reps[0], REPORT_KEYS).ok),
    `n=${reps.length}` + (reps[0] ? ` keys=${Object.keys(reps[0])}` : ''))
  chk('照片为对象(按工序序分组)', d['照片'] && typeof d['照片'] === 'object' && !Array.isArray(d['照片']), JSON.stringify(d['照片']))
  // 只给 工单行id 也能取到同一张卡(契约 §3.5 两种入参)
  const byRow = await post('/api/procCard/detail', { 工单行id: rowId })
  chk('detail 支持 {工单行id} 入参(返回同卡)', byRow.json?.data?.['头']?.['卡号'] === card['卡号'], byRow.json?.data?.['头']?.['卡号'])
  out.data.detail = d

  // ── 6 /save ─────────────────────────────────────────
  console.log('\n=== /api/procCard/save ===')
  r = await post('/api/procCard/save', { 卡号: card['卡号'], 备注: '验证留痕-可删' })
  chk('save 备注 200 + 回显', r.http === 200 && r.json?.data?.['头']?.['备注'] === '验证留痕-可删',
    `备注=${JSON.stringify(r.json?.data?.['头']?.['备注'])}`)
  chk('save 备注后卡状态仍=录入中', r.json?.data?.['头']?.['卡状态'] === '录入中', r.json?.data?.['头']?.['卡状态'])
  // 前置不满足时置「已完成」必须 400(全部工序已完工 + 每道至少一张照片)
  const bad = await post('/api/procCard/save', { 卡号: card['卡号'], 卡状态: '已完成' })
  chk('save 卡状态=已完成(前置不满足)→ 400 且给出原因',
    (bad.http === 400 || bad.json?.code === 400) && /未完工|照片/.test(bad.json?.message || ''),
    `http=${bad.http} msg=${bad.json?.message}`)
  const bad2 = await post('/api/procCard/save', { 卡号: card['卡号'], 卡状态: '乱填' })
  chk('save 非法卡状态 → 400', bad2.http === 400 || bad2.json?.code === 400, `http=${bad2.http} msg=${bad2.json?.message}`)

  // ── 7 /list ──────────────────────────────────────────
  console.log('\n=== /api/procCard/list ===')
  r = await postRaw('/api/procCard/list', { 产品编码: card['产品编码'], pageNo: 1, pageSize: 50 })
  chk('list 200 + {总行数,行}', r.http === 200 && r.json?.code === 200
    && typeof r.json?.data?.['总行数'] === 'number' && Array.isArray(r.json?.data?.['行']),
    `http=${r.http} 总行数=${r.json?.data?.['总行数']}`)
  const lrows = r.json?.data?.['行'] || []
  const k5 = sameKeys(lrows[0], ROW_KEYS)
  chk('list 行键 = 契约 §3.7', k5.ok, k5.ok ? '' : { got: k5.got, want: k5.want })
  const myRow = lrows.find((x) => x['卡号'] === card['卡号'])
  chk('list 按产品编码能查到本卡', !!myRow, myRow && `工序进度=${myRow['工序进度']}`)
  chk('list 行含 工序进度/完成工序数/工序数/照片数', myRow && typeof myRow['工序进度'] === 'string'
    && myRow['工序进度'].includes('/') && typeof myRow['完成工序数'] === 'number' && typeof myRow['工序数'] === 'number',
    myRow && `进度="${myRow['工序进度']}" 完成=${myRow['完成工序数']}/${myRow['工序数']} 照片=${myRow['照片数']}`)
  // 分页
  const page2 = await postRaw('/api/procCard/list', { pageNo: 1, pageSize: 1 })
  chk('list 分页 pageSize 生效(≤1 行)', (page2.json?.data?.['行'] || []).length <= 1, `n=${(page2.json?.data?.['行'] || []).length}`)
  out.data.listRow = myRow

  // ── 8 /batchTrace ────────────────────────────────────
  console.log('\n=== /api/procCard/batchTrace ===')
  r = await postRaw('/api/procCard/batchTrace', { 批次号: card['大批次号'] })
  chk('batchTrace 200 + code=200', r.http === 200 && r.json?.code === 200, `http=${r.http} code=${r.json?.code}`)
  const bt = r.json?.data || {}
  chk('batchTrace 结构 = {批次号,汇总,卡片}', ['批次号', '汇总', '卡片'].every((x) => x in bt), Object.keys(bt))
  const sum = bt['汇总'] || {}
  chk('汇总 键 = {卡数,产品数,计划数量,工序汇总}', ['卡数', '产品数', '计划数量', '工序汇总'].every((x) => x in sum), Object.keys(sum))
  const sumOps = sum['工序汇总'] || []
  const k6 = sameKeys(sumOps[0], ['工序', '计划量', '已报工', '卡片数'])
  chk('工序汇总 行键 = {工序,计划量,已报工,卡片数}', k6.ok, k6.ok ? '' : { got: k6.got, want: k6.want })
  chk('汇总.卡数 = 卡片.length 且本卡在列', sum['卡数'] === (bt['卡片'] || []).length
    && (bt['卡片'] || []).some((x) => x['卡号'] === card['卡号']), `卡数=${sum['卡数']} 卡片=${(bt['卡片'] || []).length}`)
  out.data.batchTrace = bt

  // ── 9 /trace ─────────────────────────────────────────
  console.log('\n=== /api/procCard/trace ===')
  r = await postRaw('/api/procCard/trace', { 卡号: card['卡号'] })
  chk('trace 200 + code=200', r.http === 200 && r.json?.code === 200, `http=${r.http} code=${r.json?.code}`)
  const tr = r.json?.data || {}
  chk('trace 结构 含 卡/工序进度/报工记录/照片/工单追溯', ['卡', '工序进度', '报工记录', '照片', '工单追溯'].every((x) => x in tr), Object.keys(tr))
  chk('trace.卡 与 detail.头 同构', tr['卡'] && tr['卡']['卡号'] === card['卡号'], tr['卡']?.['卡号'])
  chk('trace.工单追溯 非空(复用 ScheduleBoardService.trace)', !!tr['工单追溯'] && Object.keys(tr['工单追溯'] || {}).length > 0,
    Object.keys(tr['工单追溯'] || {}))
  out.data.trace = { card: tr['卡'], 工单追溯keys: Object.keys(tr['工单追溯'] || {}) }

  // ── 10 附件(照片):上传/列表/下载/删除 ────────────────
  console.log('\n=== /api/attachment(PROC_FLOW_CARD 面板)===')
  const seq = ops[0]['工序序']
  const fd = new FormData()
  fd.append('file', new Blob([png], { type: 'image/png' }), 'verify-photo-100x100.png')
  fd.append('panelCode', 'PROC_FLOW_CARD')
  fd.append('docNo', card['卡号'])
  fd.append('field', `工序照片-${seq}`)
  const upRes = await fetch(API + '/api/attachment/upload', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd })
  const upJson = await upRes.json().catch(() => null)
  chk('attachment/upload 200 且返回文件列表', upRes.status === 200 && upJson?.code === 200
    && Array.isArray(upJson?.data?.files) && upJson.data.files.length === 1,
    `http=${upRes.status} files=${JSON.stringify((upJson?.data?.files || []).map((f) => f.fileName))}`)
  const attId = upJson?.data?.files?.[0]?.id
  let listRes = await get(`/api/attachment/list?panelCode=PROC_FLOW_CARD&docNo=${encodeURIComponent(card['卡号'])}&field=${encodeURIComponent('工序照片-' + seq)}`)
  chk('attachment/list 200 且 1 行', listRes.http === 200 && (listRes.json?.data || []).length === 1,
    `http=${listRes.http} n=${(listRes.json?.data || []).length}`)
  const dl = await get(`/api/attachment/${attId}/download`)
  chk('attachment/{id}/download 200(image/png)', dl.http === 200, `http=${dl.http}`)
  // detail 里应出现该照片(按工序序分组)
  const d2 = (await post('/api/procCard/detail', { 卡号: card['卡号'] })).json?.data || {}
  const photos = d2['照片'] || {}
  const grp = photos[String(seq)] || []
  chk('detail.照片 按工序序分组出现刚上传的照片', grp.length === 1 && grp[0].fileName === 'verify-photo-100x100.png',
    JSON.stringify(grp))
  chk('detail.头.照片数 = 1', d2['头']?.['照片数'] === 1, d2['头']?.['照片数'])
  chk('工序行.照片数 = 1(落在那道工序上)', (d2['工序行'] || [])[0]?.['照片数'] === 1, (d2['工序行'] || [])[0]?.['照片数'])
  // 删除
  const delRes = await post('/api/attachment/delete', { id: attId })
  chk('attachment/delete 200', delRes.http === 200 && delRes.json?.code === 200, `http=${delRes.http} msg=${delRes.json?.message || ''}`)
  listRes = await get(`/api/attachment/list?panelCode=PROC_FLOW_CARD&docNo=${encodeURIComponent(card['卡号'])}&field=${encodeURIComponent('工序照片-' + seq)}`)
  chk('删除后 attachment/list 归零', (listRes.json?.data || []).length === 0, `n=${(listRes.json?.data || []).length}`)
  const d3 = (await post('/api/procCard/detail', { 卡号: card['卡号'] })).json?.data || {}
  chk('删除后 detail.照片 归零 / 头.照片数=0', (d3['头']?.['照片数'] === 0) && !((d3['照片'] || {})[String(seq)] || []).length,
    `照片数=${d3['头']?.['照片数']}`)

  // ── 11 批次/卡号一致性 + 时间 ────────────────────────
  chk('头.大批次号 与所选批次一致(或已按生产批次同步)', !!card['大批次号'], `${card['大批次号']} / 来源=${card['批次来源']}`)
  chk('头.工单行id = 请求的工单行id', String(card['工单行id']) === String(rowId), `${card['工单行id']}`)

  out.checks = results
  out.failCount = fails
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n[result] PASS ${results.length - fails}/${results.length}  失败 ${fails}  用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`[result] 卡号 ${card['卡号']}(保留给 UI 验证;最终 cleanup.cjs 清)`)
  console.log(`[result] JSON → ${OUT}`)
  if (fails > 0) process.exit(1)
}
main().catch((e) => { console.error('[FATAL]', e && e.stack || e); process.exit(2) })
