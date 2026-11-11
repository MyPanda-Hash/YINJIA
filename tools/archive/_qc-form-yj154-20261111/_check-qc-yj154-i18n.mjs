#!/usr/bin/env node
/**
 * 一次性词条自检 —— YJ-QR-154《出货检验功能记录表》表样改造(2026-11-11)。
 *
 * 口径(任务 task-5 第 5 条):抽出**本次相关文件**里所有 `tt('中文')` 字面量,逐个确认
 * frontend/src/i18n/locales/ 下 10 个本地语言包(en/ja/ko/zh-TW/es/de/fr/ru/vi/th)的 `biz`
 * 词典里都有对应词条;输出缺词清单。缺词 0 才算多语言交付完成。
 *
 * 三类词条来源(并集):
 *   ① SCAN_FILES 里的 `tt('…')` / `tt("…")`(显示层真源,组件改完重跑本脚本即可);
 *   ② EXTRA_TERMS:本次**新增/改名的显示串**——它们不是 tt() 调用点(菜单/流程看板的名字是
 *      `title`/`name` 字段,运行时由 LeftNav / FlowBoard 的 tt(title) 翻译),以及导出模块里的
 *      纸面固定标签(Excel 版式的默认值,组件按需传 tt() 覆盖);漏了这条会"界面英文、导出中文";
 *   ③ 已存在翻译不重复加(脚本只报缺,不写文件;写 locale 由人工/本任务脚本完成)。
 *
 * 用法(仓库根):
 *   node tools/archive/_qc-form-yj154-20261111/_check-qc-yj154-i18n.mjs
 *   node tools/archive/_qc-form-yj154-20261111/_check-qc-yj154-i18n.mjs --list   # 连已有词条一起列
 * 退出码:0 = 缺词 0;1 = 有缺词。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../..')          // → 仓库根(D:\workspace\yinjia)
const FRONTEND = resolve(ROOT, 'frontend')

/** 10 个本地语言包(= 有静态 biz 词典、切语言即生效的那些;zh-CN 是源语言不用列) */
const LOCALES = ['en', 'ja', 'ko', 'zh-TW', 'es', 'de', 'fr', 'ru', 'vi', 'th']

/** 本次相关文件(显示层真源) */
const SCAN_FILES = [
  'frontend/src/core/qc/qcProcInspExport.js',
  'frontend/src/core/qc/QcProcInspSheet.vue',
]

/**
 * 本期新增/改名的显示串(非 tt() 调用点):
 *   · 出货检验表观 —— menus.js 菜单 title + flowSpec.js 流程看板 name(2026-11-11 改名)
 *   · 出货检验功能记录表 / 表单编号 / 检验明细 / 各纸面标签 —— 导出模块默认标签(Excel 纸面版式)
 */
const EXTRA_TERMS = [
  // 任务点名要补的 10 条
  '出货检验表观',
  '出货检验功能记录表',
  '表单编号',
  '检测周期',
  '抽检方案',
  '检验明细',
  '添加批次',
  '删除批次',
  '本批结果判断',
  '表单审核人',
  // 图2 表样其余显示格/列头(新增面板表样 ⇒ 同批补词条,AGENTS.md 多语言强制规范)
  '检验项目',
  '检验方法',
  '检验要求',
  '批次号',
  '单据编号',
  '产品编码',
  '产品型号',
  '工单号',
  '检验人',
  '检验结论',
  '审核人',
  '处理意见',
  // 疑似的派生词条(设计文档/面板里出现过;缺了才补,已有则脚本不计)
  '检验结果及判断',
  '出货控制计划执行',
]

/** 读文件(容错:文件不存在时返回空串并把文件记进 MISSING_FILES) */
const missingFiles = []
function readIfExists(rel) {
  try {
    return readFileSync(resolve(ROOT, rel), 'utf8')
  } catch {
    missingFiles.push(rel)
    return ''
  }
}

/** 抽 `tt('中文')` / `tt("中文")` 的中文字面量(仅含汉字的;纯英文/变量不算) */
function extractTt(text) {
  const out = new Set()
  const re = /\btt\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g
  let m
  while ((m = re.exec(text))) {
    const lit = m[2]
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
    if (/[\u4e00-\u9fff]/.test(lit)) out.add(lit)
  }
  return out
}

/** 动态 import 一个 locale 的 biz 词典(ESM,前端包 = "type":"module") */
async function bizOf(locale) {
  const mod = await import(new URL(`file:///${resolve(FRONTEND, 'src/i18n/locales', `${locale}.js`).replace(/\\/g, '/')}`))
  const dict = (mod.default || mod)?.biz
  if (!dict || typeof dict !== 'object') throw new Error(`${locale}.js 没有 biz 词典`)
  return dict
}

const terms = new Set(EXTRA_TERMS)
for (const rel of SCAN_FILES) {
  for (const t of extractTt(readIfExists(rel))) terms.add(t)
}
const list = [...terms].sort((a, b) => a.localeCompare(b, 'zh-CN'))

let totalMissing = 0
const rows = []
for (const locale of LOCALES) {
  const biz = await bizOf(locale)
  const miss = list.filter((k) => !biz[k])
  totalMissing += miss.length
  rows.push({ locale, have: list.length - miss.length, miss })
}

// ── 输出 ──
console.log(`扫描文件(${SCAN_FILES.length}):`)
for (const f of SCAN_FILES) console.log(`  ${missingFiles.includes(f) ? '✗ 缺文件' : '✓'} ${f}`)
if (missingFiles.length) console.log(`  ⚠ 缺文件:${missingFiles.join(', ')}`)
console.log(`\n词条总数(tt 字面量 ∪ 本期新增显示串)= ${list.length}`)
const wantList = process.argv.includes('--list')
if (wantList) for (const t of list) console.log(`  · ${t}`)

console.log('\n各语言包覆盖:')
for (const r of rows) {
  const flag = r.miss.length ? `缺 ${r.miss.length}` : '齐'
  console.log(`  ${r.locale.padEnd(6)} ${String(r.have).padStart(3)}/${list.length}  ${flag}`)
  if (r.miss.length) console.log(`         缺:${r.miss.join(' / ')}`)
}

console.log(`\n缺词 ${totalMissing}${totalMissing === 0 ? '  ✅' : '  ❌(按上面清单补齐 10 个语言包)'}`)
process.exit(totalMissing === 0 ? 0 : 1)
