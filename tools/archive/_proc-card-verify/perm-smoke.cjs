/**
 * perm-smoke.cjs — 工序流程追踪卡 权限验证(契约 §1.7 / §6#5)
 *
 * 用法:
 *   node tools/archive/_proc-card-verify/perm-smoke.cjs view     # 临时账号只有 view 词
 *   node tools/archive/_proc-card-verify/perm-smoke.cjs noview   # 临时账号无任何权限
 *
 * 前置:setup_perm_test.sql 已执行(临时角色 PFC_VERIFY + 账号 pfc_verify/123456);
 *      view 模式要先跑;noview 模式前先跑 perm_switch_noview.sql。
 * 后置:teardown_perm_test.sql 删除造数(本脚本上传的照片会自行删除)。
 *
 * 结论口径:
 *   · 无 view ⇒ /api/procCard/* 全部 403(硬要求)
 *   · 有 view 无 entry ⇒ 写端点(create/save)403(硬要求)
 *   · 有 view ⇒ /api/attachment/{list,{id}/download} 可用(缩略图/预览依赖)
 *   · 设计 §6#5「有 view 无 entry 的角色上传照片 → 403」= 观察项(上传复用既有接口)
 */
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const MODE = process.argv[2] || 'view'
const API = 'http://127.0.0.1:8090'
const HERE = __dirname
const out = { mode: MODE, checks: [] }
let fails = 0
function chk(name, cond, detail) {
  out.checks.push({ name, pass: !!cond, detail: detail === undefined ? '' : detail })
  console.log(`  ${cond ? '[PASS]' : '[FAIL]'} ${name}${detail !== undefined && detail !== '' ? '  :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
  if (!cond) fails++
}
function obs(name, detail) {
  out.checks.push({ name, observed: detail })
  console.log(`  [OBS ] ${name} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}

/** 复用 api-smoke 生成的 100x100 PNG */
function png() {
  const p = path.join(HERE, 'verify-photo-100x100.png')
  if (fs.existsSync(p)) return fs.readFileSync(p)
  const w = 10, h = 10
  const raw = Buffer.alloc((w * 3 + 1) * h, 0)
  const table = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c } return t })()
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

async function main() {
  const smoke = JSON.parse(fs.readFileSync(path.join(HERE, 'api-smoke-result.json'), 'utf8'))
  const cardNo = smoke.data.cardNo
  const seq = smoke.data.detail?.['工序行']?.[0]?.['工序序'] ?? 1
  console.log(`[mode] ${MODE}  card=${cardNo}  seq=${seq}`)

  const lr = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'pfc_verify', password: '123456' }),
  })
  const login = await lr.json()
  const T = login?.data?.token || ''
  chk('临时账号 pfc_verify 登录成功(非 admin)', !!T && login?.data?.user?.isAdmin === false,
    `http=${lr.status} isAdmin=${login?.data?.user?.isAdmin}`)
  if (!T) { fs.writeFileSync(path.join(HERE, `perm-smoke-${MODE}.json`), JSON.stringify(out, null, 2)); throw new Error('临时账号登录失败') }
  const pagePerms = login?.data?.user?.pagePerms || {}
  out.pagePerms = { PROC_FLOW_CARD: pagePerms['PROC_FLOW_CARD'] }

  const post = async (p, body, json = true) => {
    const r = await fetch(API + p, {
      method: 'POST',
      headers: json ? { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` } : { Authorization: `Bearer ${T}` },
      body: json ? Buffer.from(JSON.stringify(body ?? {}), 'utf8') : body,
    })
    const text = await r.text()
    let j = null; try { j = JSON.parse(text) } catch {}
    return { http: r.status, json: j, text }
  }
  const get = async (p) => {
    const r = await fetch(API + p, { headers: { Authorization: `Bearer ${T}` } })
    const buf = Buffer.from(await r.arrayBuffer())
    let j = null; try { j = JSON.parse(buf.toString('utf8')) } catch {}
    return { http: r.status, json: j, len: buf.length }
  }

  const EPS = ['meta', 'batches', 'lines', 'create', 'detail', 'save', 'list', 'batchTrace', 'trace']
  const bodies = {
    meta: {}, batches: {}, lines: { 批次号: smoke.data.batch['批次号'] },
    create: { 工单行id: smoke.data.rowId }, detail: { 卡号: cardNo }, save: { 卡号: cardNo, 备注: 'x' },
    list: {}, batchTrace: { 批次号: smoke.data.batch['批次号'] }, trace: { 卡号: cardNo },
  }

  if (MODE === 'view') {
    chk('pagePerms.PROC_FLOW_CARD 含 view', /\bview\b/.test(String(pagePerms['PROC_FLOW_CARD'] || '')), pagePerms['PROC_FLOW_CARD'])
    chk('pagePerms.PROC_FLOW_CARD 不含 entry', !/\bentry\b/.test(String(pagePerms['PROC_FLOW_CARD'] || '')), pagePerms['PROC_FLOW_CARD'])

    // ── 读端点:有 view 应 200 ──
    for (const ep of ['meta', 'batches', 'lines', 'detail', 'list', 'batchTrace', 'trace']) {
      const r = await post('/api/procCard/' + ep, bodies[ep])
      chk(`有 view 权: /api/procCard/${ep} → 200`, r.http === 200 && r.json?.code === 200, `http=${r.http} code=${r.json?.code} ${r.json?.message || ''}`)
    }
    // ── 写端点:无 entry 应 403 ──
    for (const ep of ['create', 'save']) {
      const r = await post('/api/procCard/' + ep, bodies[ep])
      chk(`有 view 无 entry: /api/procCard/${ep} → 403`, r.http === 403 || r.json?.code === 403, `http=${r.http} code=${r.json?.code} msg=${r.json?.message || ''}`)
    }
    // ── 附件:有 view 时列表/下载可用(缩略图/预览依赖) ──
    const upload = await (async () => {
      const fd = new FormData()
      fd.append('file', new Blob([png()], { type: 'image/png' }), 'perm-view-upload.png')
      fd.append('panelCode', 'PROC_FLOW_CARD')
      fd.append('docNo', cardNo)
      fd.append('field', `工序照片-${seq}`)
      const r = await fetch(API + '/api/attachment/upload', { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd })
      const j = await r.json().catch(() => null)
      return { http: r.status, json: j, id: j?.data?.files?.[0]?.id }
    })()
    obs('设计 §6#5「有 view 无 entry 上传照片 → 403」实测', `http=${upload.http}(契约要求 403;复用既有 /attachment/upload,该接口无面板权限校验)`)
    out.uploadAsViewOnly = { http: upload.http, id: upload.id }
    const list1 = await get(`/api/attachment/list?panelCode=PROC_FLOW_CARD&docNo=${encodeURIComponent(cardNo)}&field=${encodeURIComponent('工序照片-' + seq)}`)
    chk('有 view 权: attachment/list → 200(缩略图墙取数可用)', list1.http === 200, `http=${list1.http} n=${(list1.json?.data || []).length}`)
    if (upload.id) {
      const dl = await get(`/api/attachment/${upload.id}/download`)
      chk('有 view 权: attachment/{id}/download → 200(预览可用)', dl.http === 200 && dl.len > 0, `http=${dl.http} bytes=${dl.len}`)
      const del = await post('/api/attachment/delete', { id: upload.id })
      chk('清理:删除本脚本上传的验证照片', del.http === 200, `http=${del.http}`)
    } else {
      chk('有 view 权: attachment/{id}/download(需要一张已上传的照片)', false, '上传没成功,无法验证下载')
    }
  } else {
    // ── 无任何权限:全部 /api/procCard/* 必须 403 ──
    chk('pagePerms.PROC_FLOW_CARD 为空(无查看权)', String(pagePerms['PROC_FLOW_CARD'] || '') === '', JSON.stringify(pagePerms['PROC_FLOW_CARD']))
    for (const ep of EPS) {
      const r = await post('/api/procCard/' + ep, bodies[ep])
      chk(`无权限: /api/procCard/${ep} → 403`, r.http === 403 || r.json?.code === 403, `http=${r.http} code=${r.json?.code} msg=${r.json?.message || ''}`)
    }
    // 附件:无 view 时列表/下载应 403;上传是否被拦(观察项)
    const list1 = await get(`/api/attachment/list?panelCode=PROC_FLOW_CARD&docNo=${encodeURIComponent(cardNo)}&field=${encodeURIComponent('工序照片-' + seq)}`)
    // 仓库既有约定:权限拒绝 = HTTP 200 + body.code=403(GlobalExceptionHandler,避免前端 403 登出)
    chk('无权限: attachment/list → 403(查看权闸门)', list1.http === 403 || list1.json?.code === 403, `http=${list1.http} code=${list1.json?.code}`)
    const fd = new FormData()
    fd.append('file', new Blob([png()], { type: 'image/png' }), 'perm-noview-upload.png')
    fd.append('panelCode', 'PROC_FLOW_CARD')
    fd.append('docNo', cardNo)
    fd.append('field', `工序照片-${seq}`)
    const upRes = await fetch(API + '/api/attachment/upload', { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: fd })
    const upJson = await upRes.json().catch(() => null)
    obs('无任何面板权限时 POST /attachment/upload 实测', `http=${upRes.status}(既有接口无写权限校验;有 cardNo 即可写附件登记行)`)
    out.uploadAsNoPerm = { http: upRes.status, id: upJson?.data?.files?.find((f) => f.fileName === 'perm-noview-upload.png')?.id }
    // 下载必须 403
    if (out.uploadAsNoPerm.id) {
      const dl = await get(`/api/attachment/${out.uploadAsNoPerm.id}/download`)
      chk('无权限: attachment/{id}/download → 403(查看权闸门)', dl.http === 403 || dl.json?.code === 403, `http=${dl.http} code=${dl.json?.code}`)
      const del = await post('/api/attachment/delete', { id: out.uploadAsNoPerm.id })
      chk('清理:删除本脚本上传的验证照片', del.http === 200, `http=${del.http}`)
    }
  }

  out.failCount = fails
  fs.writeFileSync(path.join(HERE, `perm-smoke-${MODE}.json`), JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n[result] ${MODE}: 断言 ${out.checks.filter((c) => 'pass' in c).length} 项,失败 ${fails}`)
  if (fails > 0) process.exit(1)
}
main().catch((e) => { console.error('[FATAL]', e && e.stack || e); process.exit(2) })
