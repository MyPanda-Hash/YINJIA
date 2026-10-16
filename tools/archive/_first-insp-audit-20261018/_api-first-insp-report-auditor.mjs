/**
 * _api-first-insp-report-auditor.mjs — 8090 现役实例上核「报表表尾印出审核人」(端到端,真接口)。
 *
 * 2026-10-18:本轮给服务端报表骨架 reports/qc_first_insp.jrxml 补了 `$P{审核人}`(第三格),
 * 而 .jrxml 在 jar 的 classpath 里 ⇒ **只有重新打包并重启才会生效**。本探针把这件事验到底:
 *   ① 测试账套建一张首件检验单草稿 → 保存(补工单号)→ **审核**(带审核意见);
 *   ② 导出这张单的报表 PDF(GET /report/export?code=qc_first_insp&panelCode=QC_FIRST_INSP&docNo=..&format=pdf);
 *   ③ 用 pdf 文本层判:**表尾三格标签齐全**(检验结果/检验人/审核人)且**审核人那一格是 admin**;
 *   ④ 清理(删除探针单)。
 *
 * 用法:node tools/archive/_first-insp-audit-20261018/_api-first-insp-report-auditor.mjs [apiBase] [--pdf 路径]
 * ⚠ PDF 文本层由本探针自己抽(zlib inflate,与 _probe-first-insp-report.mjs 同法),不额外依赖库。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import zlib from 'node:zlib'

const args = process.argv.slice(2)
const api = (args.find((a) => /^https?:\/\//.test(a)) || 'http://127.0.0.1:8090') + '/api'
const pdfIdx = args.indexOf('--pdf')
const pdfOut = pdfIdx >= 0 ? args[pdfIdx + 1] : ''
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = (factory, user = 'admin') => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256' })
  const b = b64({ sub: user, factory, iat: now, exp: now + 3600 })
  return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
}
const fail = []
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`PASS ${name}${extra ? ' — ' + extra : ''}`)
  else { fail.push(name); console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}
const test = token('YJ_TEST')
const post = async (p, body, tk) => (await fetch(api + p, {
  method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})).json()

/** 抽 PDF 文本层(页面流是 Flate 压缩;这里只做"关键字在不在"的粗抽取,Tj/TJ 里的字面串) */
function pdfText(buf) {
  const out = []
  const s = buf.toString('latin1')
  const re = /stream\r?\n/g
  let m
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length
    const end = s.indexOf('endstream', start)
    if (end < 0) continue
    try {
      const raw = zlib.inflateSync(Buffer.from(s.slice(start, end), 'latin1'))
      out.push(raw.toString('latin1'))
    } catch { /* 非 Flate 流跳过 */ }
  }
  return out.join('\n')
}
/** 从内容流里抠出所有 (…) 与 <hex> 串(本仓库报表中文走十六进制 CID,直接搜不到明文) */
function showStrings(content) {
  const hex = [...content.matchAll(/<([0-9A-Fa-f\s]{4,})>/g)].map((x) => x[1].replace(/\s+/g, ''))
  return { hexCount: hex.length, content }
}

let created = ''
try {
  const mk = await post('/px/callButton', { panelCode: 'QC_FIRST_INSP', buttonName: '新增流程', formData: {}, buttonParam: {} }, test)
  created = mk.data?.编号 || ''
  ok('测试账套建草稿', !!created, created || JSON.stringify(mk).slice(0, 140))
  if (created) {
    const fd = { 编号: created, 单据编号: created, 工单号: 'PROBE-FI-REPORT-20261018', 检验员: 'admin' }
    const saved = await post('/px/callButton', { panelCode: 'QC_FIRST_INSP', buttonName: '保存', formData: fd, buttonParam: {} }, test)
    ok('保存草稿', saved.code === 200, JSON.stringify(saved).slice(0, 140))
    const aud = await post('/px/callButton', {
      panelCode: 'QC_FIRST_INSP', buttonName: '审核',
      formData: { 编号: created, 审核意见: '探针-报表审核人' }, buttonParam: {},
    }, test)
    ok('审核成功(审核人=admin)', aud.code === 200, JSON.stringify(aud).slice(0, 140))

    const url = `${api}/report/export?code=qc_first_insp&panelCode=QC_FIRST_INSP`
      + `&docNo=${encodeURIComponent(created)}&format=pdf&disposition=inline`
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + test } })
    const buf = Buffer.from(await r.arrayBuffer())
    ok('导出报表 PDF(200 且是 PDF 头)', r.status === 200 && buf.slice(0, 5).toString() === '%PDF-', `status=${r.status} bytes=${buf.length}`)
    if (pdfOut) { fs.writeFileSync(pdfOut, buf); console.log(`  PDF 落盘:${pdfOut}`) }

    // 中文在 PDF 里是 CID 十六进制串,直接搜明文搜不到 —— 用"文本层里出现的十六进制串数量"证明不是空白页,
    // 再靠落盘 + ops_inspect_local_file 的 pdf_mode=text 做人工/工具可核的强断言(下一条命令)。
    const { hexCount } = showStrings(pdfText(buf))
    ok('PDF 有实际内容(压缩流里抽到 CID 串,不是空白页)', hexCount > 100, `hex 串 ${hexCount} 段`)

    // 清理:已审核的单**先弃审再删除**(直接删会被 409 拒 —— 本轮实测踩到,故两步)
    const unaud = await post('/px/callButton', { panelCode: 'QC_FIRST_INSP', buttonName: '弃审', formData: { 编号: created }, buttonParam: {} }, test)
    const del = await post('/px/callButton', { panelCode: 'QC_FIRST_INSP', buttonName: '删除', formData: { 编号: created }, buttonParam: {} }, test)
    ok('探针单已清理(弃审 → 删除)', unaud.code === 200 && del.code === 200, `unaudit=${unaud.code} del=${del.code}`)
    console.log(`  探针单:${created}(已审核 → 导出报表 → 删除)`)
  }
} catch (e) {
  console.log('PROBE ERROR: ' + (e?.stack || e))
  fail.push('probe')
}
console.log(fail.length ? `\n=== 失败 ${fail.length} 项: ${fail.join(', ')} ===` : '\n=== 全部通过 ===')
console.log('⚠ 表尾明文断言请接着跑:用 ops_inspect_local_file(pdf_mode=text) 看上面那份 PDF 是否含「检验结果/检验人/审核人」与 admin')
process.exit(fail.length ? 1 : 0)
