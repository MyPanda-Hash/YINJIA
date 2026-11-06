/**
 * _check-old-baseline.mjs —— 阶段 A「改前基线」复核(2026-11-04,task-4)
 *
 * 为什么单独一个复核脚本:阶段 A 取证时环境里 8090 是**旧代码**,但 DB 里的报表模板行
 * 会被并行任务(task-3)先落库 —— 落库后旧 8090 立即改走 DB 模板,现场就再也导不出旧版式。
 * 因此把「改前基线」以**文件证据**固定,本脚本负责可复核:
 *
 *   ① 18:58 时点的 /api/report/templates 快照(DB 模板落库前):
 *      baseline/20261104T1857-old-8090/report-templates-baseline.json.txt
 *      ⇒ 面板级 API 能列出 qc_oqc(classpath 注册表),而模板管理全量列表里**没有** qc_oqc 行
 *      ⇒ 证明旧 8090 当时用的是 classpath 注册表里的旧 jrxml
 *   ② 用 **HEAD(改前)版 jrxml** 离线重渲染的旧版式 PDF(不写库、只读 HSDZ_MES_TEST):
 *      baseline/20261104T1904-old-template-HEAD/old-layout-0003.pdf
 *      ⇒ 页脚含 water-agplus/惠州大亚湾/5583930;审核/批准 静态下划线;检验员取头字段值
 *   ③ 改前 jrxml 源文件(git HEAD)里的静态证据:
 *      ⇒ 页脚静态串 + 「审核：________________」/「批准：________________」两条静态表达式
 *
 * 注:18:57 那次旧 8090 直出的 PDF 抽取文本在 19:01 复跑时被同名覆盖(取证脚本已加 --force 守卫);
 *     旧版式证据以 ②③ 为准,① 作为「当时 DB 无模板行」的旁证。
 *
 * 用法: node tools/archive/_oqc-next/_check-old-baseline.mjs
 * 输出: tools/archive/_oqc-next/baseline/old-baseline-check.json / .txt
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { Results, ROOT, pdfText, saveJson, saveText, norm } from './_lib.mjs'

const BASE_DIR = path.join(ROOT, 'tools/archive/_oqc-next/baseline')
const TPL_SNAPSHOT = path.join(BASE_DIR, '20261104T1857-old-8090/report-templates-baseline.json.txt')
const OLD_TPL_DIR = path.join(BASE_DIR, '20261104T1904-old-template-HEAD')
const FOOTER_MARKS = ['water-agplus', '惠州大亚湾', '5583930']
const r = new Results('OQC 改前基线复核')

// ① 18:58 的报表模板注册快照:面板级 registry 有 qc_oqc,模板管理全量列表无 qc_oqc(DB 无行)
if (fs.existsSync(TPL_SNAPSHOT)) {
  const snap = fs.readFileSync(TPL_SNAPSHOT, 'utf8')
  const jsonLines = snap.split('\n').filter((l) => l.trim().startsWith('{'))
  const panelApi = jsonLines[0] || ''
  const manageList = jsonLines[1] || ''
  r.fact('模板注册快照来源', TPL_SNAPSHOT)
  r.check('旧环境:面板级 templates API 有 qc_oqc(classpath 注册表)', panelApi.includes('"code":"qc_oqc"'), panelApi.slice(0, 160))
  r.check('旧环境:模板管理全量列表无 qc_oqc(当时 DB yj_report_template 无行)',
    manageList.length > 0 && !manageList.includes('qc_oqc') && manageList.includes('so_order'), manageList.slice(0, 160))
} else {
  r.check('模板注册快照存在', false, TPL_SNAPSHOT)
}

// ② HEAD(改前)jrxml 离线重渲染的旧版式 PDF
const oldPdf = path.join(OLD_TPL_DIR, 'old-layout-0003.pdf')
if (fs.existsSync(oldPdf)) {
  const txt = path.join(OLD_TPL_DIR, 'old-layout-0003.txt')
  const t = pdfText(oldPdf, txt)
  const nt = norm(t.text)
  r.fact('旧版式重渲染件', { pdf: oldPdf, pages: t.pages, chars: t.chars })
  r.check('旧版式重渲染:页脚三标记齐全',
    FOOTER_MARKS.every((m) => nt.includes(m)), FOOTER_MARKS.map((m) => `${m}=${nt.includes(m)}`).join(' '))
  r.check('旧版式重渲染:审核/批准 仍是静态下划线',
    /审核：_{3,}/.test(nt) && /批准：_{3,}/.test(nt), '')
  r.check('旧版式重渲染:检验员格取头字段值(数据 OQC-2026-11-0003 检验员=admin)',
    /检验员：admin/.test(nt), (nt.match(/检验员：[^\s]*/) || [''])[0])
} else {
  r.check('旧版式重渲染 PDF 存在', false, oldPdf)
}

// ③ 改前 jrxml 源文件静态证据(git HEAD)
try {
  const src = execFileSync('git', ['show', 'HEAD:backend/src/main/resources/reports/qc_oqc.jrxml'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  r.check('HEAD jrxml 含页脚静态串 water-agplus', src.includes('water-agplus'))
  r.check('HEAD jrxml 含静态「审核：________________」', src.includes('"审核：________________"'))
  r.check('HEAD jrxml 含静态「批准：________________」', src.includes('"批准：________________"'))
  r.fact('HEAD jrxml 长度', src.length)
} catch (e) {
  r.check('git show HEAD jrxml 可读取', false, e.message.slice(0, 200))
}

const summary = r.summary()
summary.files = {
  templateSnapshot: TPL_SNAPSHOT,
  oldTemplatePdf: oldPdf,
  oldTemplateJrxml: path.join(OLD_TPL_DIR, 'qc_oqc.HEAD.jrxml'),
}
await saveJson(path.join(BASE_DIR, 'old-baseline-check.json'), summary)
await saveText(path.join(BASE_DIR, 'old-baseline-check.txt'),
  summary.items.map((i) => `${i.ok === null ? 'FACT' : i.ok ? 'PASS' : 'FAIL'}  ${i.name}${i.detail ? '  -- ' + i.detail : ''}`).join('\n') + `\n\nRESULT: ${summary.result} (PASS ${summary.pass} / FAIL ${summary.fail})\n`)
process.exit(summary.fail === 0 ? 0 : 1)
