/**
 * _api-baseline.mjs —— 出厂检验报告报表「基线 / 回归」取证(2026-11-04,task-4)
 *
 * 一条命令覆盖三个阶段:
 *   阶段 A(旧环境)   : --expect=old   要求 PDF 页脚含 water-agplus/惠州大亚湾/5583930、签署行全下划线
 *   阶段 A(现场漂移) : --expect=drift 只记录页脚/签署的**实际**极性(任务并行导致 DB 模板已先落库时用)
 *   阶段 B(新代码)   : --expect=new   要求页脚**不含**上面三个串、且 审核：<一级审批人>/批准：<超级管理员> 落值
 *
 * 输出到 --out 目录(默认 baseline/<前缀>):<prefix>.pdf / .xlsx / .txt / .json
 * 只读:只做登录 + GET + 报表导出,不写业务数据。
 *
 * 用法:
 *   node tools/archive/_oqc-next/_api-baseline.mjs                      # 旧环境基线(old)
 *   node tools/archive/_oqc-next/_api-baseline.mjs --expect=drift
 *   node tools/archive/_oqc-next/_api-baseline.mjs --base http://127.0.0.1:8091 \
 *        --expect=new --docNo AUTO_OQC-... --audit-name 管理员 --approve-name 系统管理员 \
 *        --out tools/archive/_oqc-next/phaseB --prefix phaseB-qc_oqc
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  Results, ROOT, login, api, listOqcDocs, pdfText, xlsxText, saveJson, saveText, norm,
} from './_lib.mjs'

const args = process.argv.slice(2)
const arg = (name, def) => {
  const eq = args.find((a) => a.startsWith('--' + name + '='))
  if (eq) return eq.slice(name.length + 3)
  const i = args.indexOf('--' + name)
  if (i < 0) return def
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const BASE = String(arg('base', 'http://127.0.0.1:8090'))
const FACTORY = String(arg('factory', 'YINJIA-MES'))
const DOC_NO = String(arg('docNo', 'OQC-2026-11-0004'))
const OUT_DIR = path.resolve(ROOT, String(arg('out', 'tools/archive/_oqc-next/baseline')))
const PREFIX = String(arg('prefix', 'qc_oqc'))
const EXPECT = String(arg('expect', 'drift')) // old | new | drift(缺省:现场已被并行任务推进时只记录实际极性)
const AUDIT_NAME = arg('audit-name', null)
const APPROVE_NAME = arg('approve-name', null)
fs.mkdirSync(OUT_DIR, { recursive: true })
const FORCE = args.includes('--force')
/** 证据文件不覆盖:已存在即报错(加 --force 或换 --prefix),避免误删前一次取证 */
const guard = (p) => {
  if (!FORCE && fs.existsSync(p)) throw new Error('证据文件已存在,拒绝覆盖: ' + p + ' (换 --prefix 或加 --force)')
  return p
}

const FOOTER_MARKS = ['water-agplus', '惠州大亚湾', '5583930']
const r = new Results(`OQC 报表 ${EXPECT} @ ${BASE} docNo=${DOC_NO}`)
r.fact('参数', { base: BASE, factory: FACTORY, docNo: DOC_NO, expect: EXPECT, outDir: OUT_DIR, prefix: PREFIX })

try {
  // ── 0. 登录 ──
  const { token, user } = await login(BASE, { factory: FACTORY })
  const cli = api(BASE, token)
  r.check('登录成功(admin/' + FACTORY + ')', !!token, `realName=${user.realName || user.userName || ''}`)

  // ── 1. 左栏列表(仅记录基线事实;测试单可能不在旧库/可能已作废) ──
  const list = await listOqcDocs(cli)
  r.fact('左栏列表 totalSize', list.totalSize ?? list.total ?? 0)

  // ── 2. 报表模板注册 ──
  const tpl = await cli.getJson('/api/report/templates?panelCode=QC_OQC_REPORT')
  const tpls = tpl.data || []
  const t = tpls.find((x) => x.code === 'qc_oqc')
  r.check('报表模板 API 含 qc_oqc(出厂检验报告)', !!t, JSON.stringify(tpls))

  // ── 3. 导出 PDF ──
  const pdfUrl = `/api/report/export?code=qc_oqc&panelCode=QC_OQC_REPORT&docNo=${encodeURIComponent(DOC_NO)}&format=pdf`
  const pdf = await cli.getBinary(pdfUrl)
  const pdfPath = guard(path.join(OUT_DIR, `${PREFIX}.pdf`))
  fs.writeFileSync(pdfPath, pdf.buf)
  r.check('导出 PDF HTTP 200 + content-type=pdf', pdf.status === 200 && pdf.contentType.includes('pdf'), `status=${pdf.status} ct=${pdf.contentType} bytes=${pdf.buf.length}`)
  r.check('PDF 首字节 %PDF-', pdf.buf.subarray(0, 5).toString('latin1') === '%PDF-', JSON.stringify(pdf.buf.subarray(0, 8).toString('latin1')))
  r.check('PDF 字节数 > 10KB', pdf.buf.length > 10 * 1024, pdf.buf.length + ' bytes')

  // ── 4. PDF 文本 + 页脚/签署断言 ──
  const txtPath = guard(path.join(OUT_DIR, `${PREFIX}.txt`))
  const pdfTxt = pdfText(pdfPath, txtPath)
  const nt = norm(pdfTxt.text)
  r.check('PDF 文本层可抽取(页数/字符数)', pdfTxt.pages >= 1 && pdfTxt.chars > 200, `pages=${pdfTxt.pages} chars=${pdfTxt.chars}`)
  r.check('PDF 含标题「出厂检验报告」', nt.includes('出厂检验报告'))
  r.check('PDF 含模板编号 YJ-QR-05/A1', nt.includes('YJ-QR-05/A1'))
  const hasFooter = FOOTER_MARKS.every((m) => nt.includes(m))
  const hasUnderscoreAudit = /审核：_{3,}/.test(nt)
  const hasUnderscoreApprove = /批准：_{3,}/.test(nt)
  const sigAudit = (nt.match(/审核：[^\s]{0,20}/) || [''])[0]
  const sigApprove = (nt.match(/批准：[^\s]{0,20}/) || [''])[0]
  if (EXPECT === 'old') {
    r.check('PDF 基线:页脚三个标记齐全(water-agplus/惠州大亚湾/5583930)', hasFooter, FOOTER_MARKS.map((m) => `${m}=${nt.includes(m)}`).join(' '))
    r.check('PDF 基线:签署行 审核/批准 均为下划线(无落值)', hasUnderscoreAudit && hasUnderscoreApprove, `审核=${hasUnderscoreAudit} 批准=${hasUnderscoreApprove}`)
  } else if (EXPECT === 'new') {
    r.check('PDF 新口径:页脚标记全部消失', !hasFooter, FOOTER_MARKS.map((m) => `${m}=${nt.includes(m)}`).join(' '))
    if (AUDIT_NAME) r.check('PDF 新口径:审核落值 = ' + AUDIT_NAME, nt.includes('审核：' + norm(AUDIT_NAME)), '实际-' + sigAudit)
    if (APPROVE_NAME) r.check('PDF 新口径:批准落值 = ' + APPROVE_NAME, nt.includes('批准：' + norm(APPROVE_NAME)), '实际-' + sigApprove)
  } else {
    r.fact('页脚标记是否齐全(drift 记录)', hasFooter)
    r.fact('签署 审核 下划线 / 批准 下划线(drift 记录)', { 审核下划线: hasUnderscoreAudit, 批准下划线: hasUnderscoreApprove, 审核: sigAudit, 批准: sigApprove })
  }

  // ── 5. 导出 XLSX ──
  const xlsxUrl = `/api/report/export?code=qc_oqc&panelCode=QC_OQC_REPORT&docNo=${encodeURIComponent(DOC_NO)}&format=xlsx`
  const xl = await cli.getBinary(xlsxUrl)
  const xlsxPath = guard(path.join(OUT_DIR, `${PREFIX}.xlsx`))
  fs.writeFileSync(xlsxPath, xl.buf)
  r.check('导出 XLSX HTTP 200 + PK 头', xl.status === 200 && xl.buf.subarray(0, 2).toString('latin1') === 'PK', `status=${xl.status} ct=${xl.contentType} bytes=${xl.buf.length}`)
  r.check('XLSX 字节数 > 5KB', xl.buf.length > 5 * 1024, xl.buf.length + ' bytes')
  const xt = norm(xlsxText(xlsxPath))
  const xHasFooter = FOOTER_MARKS.every((m) => xt.includes(m))
  if (EXPECT === 'old') r.check('XLSX 基线:含旧页脚 water-agplus', xt.includes('water-agplus'), `xlsx文本长度=${xt.length}`)
  if (EXPECT === 'new') {
    r.check('XLSX 新口径:旧页脚标记消失', !xHasFooter, FOOTER_MARKS.map((m) => `${m}=${xt.includes(m)}`).join(' '))
    if (AUDIT_NAME) r.check('XLSX 新口径:审核落值 = ' + AUDIT_NAME, xt.includes('审核：' + norm(AUDIT_NAME)), '')
    if (APPROVE_NAME) r.check('XLSX 新口径:批准落值 = ' + APPROVE_NAME, xt.includes('批准：' + norm(APPROVE_NAME)), '')
  }
  if (EXPECT === 'drift') r.fact('XLSX 旧页脚标记是否齐全(drift 记录)', xHasFooter)
  r.fact('XLSX 文本长度', xt.length)

  // ── 6. 证据落盘 ──
  const summary = r.summary()
  summary.env = { base: BASE, factory: FACTORY, docNo: DOC_NO, expect: EXPECT, outDir: OUT_DIR, prefix: PREFIX }
  summary.files = { pdf: pdfPath, xlsx: xlsxPath, pdfText: txtPath }
  await saveJson(path.join(OUT_DIR, `${PREFIX}.json`), summary)
  await saveText(path.join(OUT_DIR, `${PREFIX}-result.txt`),
    summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n') + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
  process.exit(summary.fail === 0 ? 0 : 1)
} catch (e) {
  console.error('[FATAL]', e.stack || e.message)
  process.exit(2)
}
