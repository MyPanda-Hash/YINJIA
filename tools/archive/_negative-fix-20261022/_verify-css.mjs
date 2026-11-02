/** 源码级验证:特采单的渲染结构里一定有 .q-vrows,而 RD 系列没有 */
import { readFileSync } from 'node:fs'

const vue = readFileSync('D:/YINJIA-main/frontend/src/core/views/DocSheet.vue', 'utf8')

// ① 找 pairs 行(带 vcell)的模板块
const qvrows = /class="q-vrows"/g
console.log('.q-vrows 出现次数:', (vue.match(qvrows) || []).length)

// ② 确认它渲染的是 config.rows 里 kind==='pairs' 且 vcell !== undefined
const idx = vue.indexOf('class="q-vrows"')
console.log('\n--- q-vrows 上下文 ---')
console.log(vue.slice(Math.max(0, idx - 500), idx + 120))

// ③ 确认 QC_TC_IN 的 config 里有 vcell
const cfg = readFileSync('D:/YINJIA-main/frontend/src/core/views/docSheetConfigs.js', 'utf8')
const m = cfg.match(/QC_TC_IN:\s*\{([\s\S]*?)\n  \},/)
if (m) {
  const body = m[1]
  console.log('\n--- QC_TC_IN 配置里的 vcell ---')
  const vcells = [...body.matchAll(/vcell:\s*'([^']*)'/g)].map((x) => x[1])
  console.log('   vcell 值:', JSON.stringify(vcells), '共', vcells.length, '个 pairs 行')
  console.log('   ⇒ 有 vcell ⇒ 渲染时走 q-vrun/q-vrows 分支 ⇒ 选择器 :has(.q-vrows) 命中 ✅')
  console.log('   ⇒ 纸面会被设为 938px 宽 + zoom 0.78')
}

// ④ RD 系列不应命中
const rd = cfg.match(/approvalSheetCfg\s*=\s*\{([\s\S]*?)\n\}/)
console.log('\n--- RD 立项申请表 ---')
console.log('   有 vcell:', rd ? /vcell:/.test(rd[1]) : 'n/a', '(应为 false ⇒ 走 as-no/as-name,不被选择器命中)')
