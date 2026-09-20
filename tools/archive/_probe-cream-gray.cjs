/**
 * _probe-cream-gray.cjs — 「粉色 → 奶油灰」配色改动自检
 *
 * 断言四件事(纯源码静态检查,不依赖浏览器):
 *   ① 粉色系色值已从源码彻底消失(#f9dfe2 / #fdeef0)
 *   ② 两张纸(RecordSheetPanels / DataRecordSheet)的 .rs-sectionbar **同色**
 *      —— 它们是一族纸张,色值漂移一眼可见(与 recordSheetConfigs 数据键同类的"多处副本"风险)
 *   ③ 新色确为"奶油灰":暖调(红>绿>蓝)、低饱和、高明度(不与纸张白看齐、也不成深色块)
 *   ④ 对比度达标:区块条/说明段的正文字色 vs 新底色 ≥ 7:1(WCAG AAA 正文)
 *
 * 用法:node tools/archive/_probe-cream-gray.cjs
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const SRC = path.join(__dirname, '..', '..', 'frontend', 'src', 'core', 'views')
const FILES = {
  record: path.join(SRC, 'RecordSheetPanels.vue'),
  data: path.join(SRC, 'DataRecordSheet.vue'),
  progress: path.join(SRC, 'ProgressControlSheet.vue'),
}

let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  ' + e : ''}`)) }

const read = (p) => fs.readFileSync(p, 'utf8')
/** 去掉注释再检查色值 —— 注释里写"原为 #f9dfe2"是**说明**不是用法,不能算命中 */
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
/** 支持 3 位与 6 位 hex(#333 / #ECEAE3) */
function hex(h) {
  const s = h.trim().replace('#', '')
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}
/** 相对亮度(WCAG) */
function lum(h) {
  const [r, g, b] = hex(h).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** 取某文件的某个 CSS 规则体 */
function ruleBody(text, selector) {
  const i = text.indexOf(selector)
  if (i < 0) return null
  const open = text.indexOf('{', i)
  const close = text.indexOf('}', open)
  return open < 0 || close < 0 ? null : text.slice(open + 1, close)
}
function prop(body, name) {
  const m = body && body.match(new RegExp(name + '\\s*:\\s*([^;]+);'))
  return m ? m[1].trim() : null
}

const tRecord = read(FILES.record)
const tData = read(FILES.data)
const tProg = read(FILES.progress)

console.log('① 粉色已彻底移除(注释不计 —— 注释里写"原为 #f9dfe2"是说明,不是用法)')
for (const [name, t] of [['RecordSheetPanels', tRecord], ['DataRecordSheet', tData], ['ProgressControlSheet', tProg]]) {
  const live = stripComments(t)
  check(`${name} 无生效中的 #f9dfe2`, !/#f9dfe2/i.test(live))
  check(`${name} 无生效中的 #fdeef0`, !/#fdeef0/i.test(live))
}

console.log('\n② 两张纸的 .rs-sectionbar 同色')
const bgRecord = prop(ruleBody(tRecord, '.rs-sectionbar'), 'background')
const bgData = prop(ruleBody(tData, '.rs-sectionbar'), 'background')
console.log(`   RecordSheetPanels = ${bgRecord}   DataRecordSheet = ${bgData}`)
check('区块条底色一致', bgRecord && bgData && bgRecord.toLowerCase() === bgData.toLowerCase(), `${bgRecord} vs ${bgData}`)

console.log('\n③ 新色确为「奶油灰」')
const barBg = (bgRecord || '').trim()
check('底色是 6 位 hex', /^#[0-9a-fA-F]{6}$/.test(barBg), barBg)
if (/^#[0-9a-fA-F]{6}$/.test(barBg)) {
  const [r, g, b] = hex(barBg)
  console.log(`   ${barBg} → R=${r} G=${g} B=${b}  (R−B=${r - b})`)
  check('暖调:R ≥ G ≥ B 且 R−B 在 [4,20](暖而不偏红)', r >= g && g >= b && (r - b) >= 4 && (r - b) <= 20, `R-B=${r - b}`)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const sat = (mx - mn) / mx
  console.log(`   饱和度(HSV S) ≈ ${sat.toFixed(3)}`)
  check('低饱和:HSV S < 0.10(灰调而非色块)', sat < 0.10, sat.toFixed(3))
  check('高明度:R > 220(浅底,不与纸张白看齐但也不成深块)', r > 220, String(r))
  check('与纸张白不同(否则条带看不见):R,G,B 至少两项 < 250', [r, g, b].filter((v) => v < 250).length >= 2)
}

console.log('\n④ 对比度(WCAG)')
const barText = prop(ruleBody(tRecord, '.rs-sectionbar'), 'color')
const cBar = /^#[0-9a-fA-F]{6}$/.test(barBg) && barText ? contrast(barBg, barText.trim()) : 0
console.log(`   区块条 ${barText} on ${barBg} = ${cBar.toFixed(2)}:1`)
check('区块条对比度 ≥ 7:1', cBar >= 7, cBar.toFixed(2))

const princBody = ruleBody(tProg, '.ps-principle')
const pBg = prop(princBody, 'background'), pFg = prop(princBody, 'color')
const cP = pBg && pFg && /^#[0-9a-fA-F]{6}$/.test(pBg.trim()) && /^#[0-9a-fA-F]{6}$/.test(pFg.trim())
  ? contrast(pBg.trim(), pFg.trim()) : 0
console.log(`   说明段 ${pFg} on ${pBg} = ${cP.toFixed(2)}:1`)
check('说明段底色已是奶油灰(非原粉)', pBg && pBg.trim().toLowerCase() !== '#fdeef0', String(pBg))
check('说明段对比度 ≥ 7:1', cP >= 7, cP.toFixed(2))

console.log('\n⑤ 打印态不受影响(打印仍去底色)')
check('打印覆盖规则仍在(background: transparent)', /approval-printing[\s\S]{0,200}background:\s*transparent/.test(tRecord))

console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
