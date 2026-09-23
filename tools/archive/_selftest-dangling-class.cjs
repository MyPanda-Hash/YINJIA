/**
 * _selftest-dangling-class.cjs — 给 _probe-spec-cover.cjs 的「悬空类名」检测器做自测
 *
 * 为什么必须自测:这条检测器**前两版都是假绿**——
 *   ① 弱正则匹配"引用",认不出 querySelector('td.x, .y') 复合选择器里的第二个类;
 *   ② "CSS 是否定义"只查 `.类名` 是否出现,于是**选择器字符串自己**被当成"定义了样式",
 *      悬空仍然报通过。拿到真回归时两版都没报警。
 * 修完后必须证明它真的能分辨,否则等于没加这条断言 —— 用构造样例正反测。
 *
 * 用法:node tools/archive/_selftest-dangling-class.cjs
 */
'use strict'

/** 与 _probe-spec-cover.cjs 第 ④ 段**逐字相同**的判定逻辑 */
function danglingOf(vue) {
  const referenced = [...new Set(vue.match(/rsp-(?:cover|sign)-[a-z0-9-]+/g) || [])]
  return referenced.filter((c) => {
    const cssRule = new RegExp(`(^|[}\\n])\\s*\\.${c}(?![a-z0-9-])\\s*(?:[,{]|:[a-z]|>|\\s+[.\\w:])`, 'm').test(vue)
    const inHtmlClass = new RegExp(`class="[^"]*\\b${c}(?![a-z0-9-])`).test(vue)
    const inQuery = new RegExp(`[.'"]${c}(?![a-z0-9-])`).test(vue)
    return (inHtmlClass || inQuery) && !cssRule
  })
}

const CASES = [
  ['干净态:模板引用 + 有 CSS 规则',
    '<td class="rsp-cover-lb">x</td>\n.rsp-cover-lb {\n  color: red;\n}',
    []],
  ['悬空:querySelector 复合选择器里的类(本轮真踩的 bug)',
    "q('td.rs-label, .rsp-cover-label, th')\n.rsp-cover-lb {\n  color: red;\n}",
    ['rsp-cover-label']],
  ['悬空:模板 class 无对应样式',
    '<td class="rsp-cover-ghost">x</td>\n.rsp-cover-lb {\n  color: red;\n}',
    ['rsp-cover-ghost']],
  ['非悬空:只有 CSS 规则、无人引用(会被 tree-shake,由正向断言管)',
    '.rsp-cover-orphan {\n  color: red;\n}',
    []],
  ['不误判前缀:rsp-cover-lb2 不应因 rsp-cover-lb 有样式就被放过',
    '<td class="rsp-cover-lb2">x</td>\n.rsp-cover-lb {\n  color: red;\n}',
    ['rsp-cover-lb2']],
  ['干净态:多个选择器共用一条规则(逗号续行)',
    '<td class="rsp-cover-lb">x</td>\n.rsp-cover-lb,\n.rsp-cover-vl {\n  color: red;\n}',
    []],
  ['非悬空:只在 :deep() 组合里出现(第三版曾误报假红)',
    '<el-input class="rsp-sign-input" />\n.rsp-sign-input :deep(.el-input__wrapper) {\n  padding: 0;\n}',
    []],
]

let ok = true
for (const [name, src, want] of CASES) {
  const got = danglingOf(src)
  const good = JSON.stringify(got) === JSON.stringify(want)
  if (!good) ok = false
  console.log(`${good ? '  ✓' : '  ✗'} ${name}`)
  if (!good) console.log(`      期望 ${JSON.stringify(want)}  实得 ${JSON.stringify(got)}`)
}
console.log(`\n${ok ? `检测器判定正确(${CASES.length}/${CASES.length},非空转)` : '检测器有问题'}`)
process.exit(ok ? 0 : 1)
