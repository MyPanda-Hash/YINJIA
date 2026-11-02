/**
 * 验证特采单「④ 文档输出」里的 导出报表 / 导出 已隐藏。
 * 说明:构建产物压缩后变量名会变(DOC_OUTPUT_HIDDEN → Ov 等),
 * 所以按「配置内容 + 逻辑形态」验证,而不是按变量名。
 */
import { readFileSync, readdirSync } from 'node:fs'

const DIST = 'D:/YINJIA-main/frontend/dist/assets'
let js = null, name = null
for (const f of readdirSync(DIST)) {
  if (!/^PanelxList-.*\.js$/.test(f)) continue
  const c = readFileSync(`${DIST}/${f}`, 'utf8')
  if (c.includes('QC_TC_IN') && c.includes('导出报表')) { js = c; name = f; break }
}
if (!js) { console.error('❌ 找不到含特采单逻辑的 chunk'); process.exit(1) }
console.log('构建产物:', name, `(${(js.length / 1024).toFixed(0)} KB)`)

// 提取隐藏配置:  {QC_TC_IN:["导出报表","导出"]}
const cfg = js.match(/\{\s*QC_TC_IN\s*:\s*\[\s*"导出报表"\s*,\s*"导出"\s*\]\s*\}/)
const hasSet = /new Set\(/.test(js)
const reportCond = /"导出报表"\)/.test(js) || /has\(\s*"导出报表"\s*\)/.test(js)
const exportCond = /has\(\s*"导出"\s*\)/.test(js)

const checks = [
  ['构建产物含隐藏配置 QC_TC_IN:["导出报表","导出"]', Boolean(cfg)],
  ['该配置被包成 Set 供模板判断', hasSet],
  ['「导出报表」按钮受隐藏判断控制', reportCond],
  ['「导出」按钮受隐藏判断控制', exportCond],
]

const vue = readFileSync('D:/YINJIA-main/frontend/src/core/views/PanelxList.vue', 'utf8')
const srcChecks = [
  ['源码:DOC_OUTPUT_HIDDEN 含 QC_TC_IN', /QC_TC_IN:\s*\['导出报表',\s*'导出'\]/.test(vue)],
  ['源码:侧栏「导出报表」带隐藏条件', /user\.isAdmin\) && !docOutputHiddenSet\.has\('导出报表'\)/.test(vue)],
  ['源码:侧栏「导出」带隐藏条件', /v-if="!docOutputHiddenSet\.has\('导出'\)"/.test(vue)],
  ['源码:工具栏「导出报表」也带条件', (vue.match(/docOutputHiddenSet\.has\('导出报表'\)/g) || []).length >= 2],
  ['源码:打印按钮未受影响', /v-if="isApprovalDoc" class="as-side-btn" @click="printApprovalSheet"/.test(vue)],
  ['源码:扫描填单未受影响', /class="as-side-btn"[\s\S]{0,120}扫描填单/.test(vue)],
]

let pass = 0, all = 0
console.log('\n=== 构建产物 ===')
for (const [n, ok] of checks) { all++; if (ok) pass++; console.log(`${ok ? '✅' : '❌'} ${n}`) }
console.log('\n=== 源码 ===')
for (const [n, ok] of srcChecks) { all++; if (ok) pass++; console.log(`${ok ? '✅' : '❌'} ${n}`) }
console.log(`\n合计 ${pass}/${all}`)
if (cfg) console.log('\n提取到的配置:', cfg[0])
process.exit(pass === all ? 0 : 1)
