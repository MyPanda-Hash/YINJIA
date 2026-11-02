/**
 * i18n-static.cjs — 工序流程追踪卡 多语言**静态覆盖**检查(AGENTS 多语言强制规范)
 *
 * 做法:把页面 5 个组件 + api helper 里所有 tt('中文原文') 的字面量抽出来,
 *       逐个到 en.js / ja.js 的 biz 词条里找;缺失即列出(动态走查之前先兜住"没词条")。
 * 用法: node tools/archive/_proc-card-verify/i18n-static.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const SRC = 'D:/workspace/yinjia/frontend/src'
const FILES = [
  'views/modules/plan/ProcFlowCard.vue',
  'views/modules/plan/procFlowCardEditor.vue',
  'views/modules/plan/procFlowCardPhotos.vue',
  'views/modules/plan/procFlowCardTable.vue',
  'views/modules/plan/procFlowCardTrace.vue',
  'views/modules/plan/procFlowCardApi.js',
]

/** 从源码抽 tt(...) 里的字符串字面量(含 tt(a || '兜底') 这种) */
function literalsOf(src) {
  const out = new Set()
  const re = /tt\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)(?:\s*\|\|\s*(?:'([^']*)'|"([^"]*)"))?/g
  let m
  while ((m = re.exec(src))) {
    for (const g of [m[1], m[2], m[3], m[4], m[5]]) {
      if (g && /\S/.test(g) && !g.includes('${') && !g.includes("'")) out.add(g.trim())
      if (m[1] || m[2] || m[3]) break
    }
  }
  // tt(cond ? 'a' : 'b') / tt(String(k)) 等动态调用的字面量:扫 tt( ... ) 括号内的引号串
  const re2 = /tt\(([^()]*)\)/g
  while ((m = re2.exec(src))) {
    const inner = m[1]
    for (const s of inner.matchAll(/'([^']+)'/g)) {
      const v = s[1].trim()
      if (v && !v.includes('${')) out.add(v)
    }
  }
  return [...out]
}

/** 收集 en.js/ja.js 里的词条 key(对象字面量 '中文': 'x') */
function keysOf(file) {
  const txt = fs.readFileSync(file, 'utf8')
  const set = new Set()
  for (const m of txt.matchAll(/^\s*'((?:[^'\\]|\\.)+)'\s*:/gm)) set.add(m[1].replace(/\\'/g, "'"))
  return set
}

function main() {
  const en = keysOf(path.join(SRC, 'i18n/locales/en.js'))
  const ja = keysOf(path.join(SRC, 'i18n/locales/ja.js'))
  const report = { files: [], missingEn: [], missingJa: [], total: 0 }
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(SRC, f), 'utf8')
    // 纯标点/占位符(如 '-')不是可翻译文案,跳过(不作为缺词条)
    const lits = literalsOf(src).filter((x) => /[\u4e00-\u9fa5A-Za-z]/.test(x))
    const me = lits.filter((x) => !en.has(x))
    const mj = lits.filter((x) => !ja.has(x))
    report.files.push({ file: f, literals: lits.length, missingEn: me, missingJa: mj })
    report.total += lits.length
    report.missingEn.push(...me.map((x) => ({ file: f, text: x })))
    report.missingJa.push(...mj.map((x) => ({ file: f, text: x })))
  }
  console.log('=== tt() 字面量静态覆盖 ===')
  for (const f of report.files) {
    console.log(`${f.missingEn.length === 0 ? '[PASS]' : '[FAIL]'} ${f.file}: ${f.literals} 条,缺 en ${f.missingEn.length} / 缺 ja ${f.missingJa.length}`)
    if (f.missingEn.length) console.log('      缺 en: ' + JSON.stringify(f.missingEn))
    if (f.missingJa.length) console.log('      缺 ja: ' + JSON.stringify(f.missingJa))
  }
  // 额外:页面级面板名 / 动作词 必须在 yj_translation(migration 里),这里只查前端词条表里有没有面板名
  const panel = '工序流程追踪卡'
  console.log(`${en.has(panel) ? '[PASS]' : '[WARN]'} 面板名「${panel}」在前端 en.js 词条表${en.has(panel) ? '存在' : '不存在(后端 yj_translation 下发,不在此表也正常)'}`)
  report.ok = report.missingEn.length === 0
  fs.writeFileSync(path.join(__dirname, 'i18n-static-result.json'), JSON.stringify(report, null, 2), 'utf8')
  console.log(`\n[result] 文案 ${report.total} 条;缺 en ${report.missingEn.length} 条;缺 ja ${report.missingJa.length} 条`)
  if (!report.ok) process.exit(1)
}
main()
