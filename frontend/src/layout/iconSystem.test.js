/**
 * iconSystem.test.js —— 图标体系（2026-10-31，按本地 antd 设计库对齐）
 *
 * 【依据】C:/Users/x1787/.dsh/design-kits/antd 的规则：
 *   · DESIGN-GUIDE §10「图标」：点/元素尺寸取 16 的倍数；纯图标按钮必须配 Tooltip；
 *   · PATTERNS「图标按钮」：图标按钮用于密集工具区，同一行只用**一套**图标；
 *   · 控件高 32（小 24）⇒ 纯图标按钮命中区 32×32，靠控件撑开而不靠字号。
 *
 * 【改动前实测（本机 8090 活体）】
 *   · 图标字号六种：17 / 16 / 15 / 14 / 13 / 12；
 *   · 顶栏纯图标按钮命中区只有 17×17（点不中）；
 *   · 左侧导航「我的桌面」是实心房子，与同列其它模块的线框图标混排；
 *   · 顶栏帮助是实心黑问号、用户是实心人像，夹在铃铛/搜索这些线框之间；
 *   · 侧栏展开箭头 12px 却用了正文字色，比它指向的标签还抢眼。
 *
 * 【为什么钉成测试】这类问题**不会报错**：加一个 `font-size: 17px` 或换回一个 *Filled 图标，
 *   界面照样能用，只是又慢慢散回六种尺寸、实心虚心混排。钉住四条最容易被改回去的。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const css = read('../styles/index.css')
const menus = read('../business/menus.js')
const topbar = read('./TopBar.vue')
const nav = read('./LeftNav.vue')
const notice = read('./NoticeCenter.vue')

/** 剥掉注释：注释里会写「原来是 HomeFilled」这类说明，不能当成用法来判 */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// ── ① token 必须存在 ─────────────────────────────────────────────
test('图标 token 四件套在 index.css 里', () => {
  for (const t of ['--ic-main', '--ic-sub', '--ic-hit', '--ic-gap']) {
    assert.match(css, new RegExp(t + '\\s*:'), `index.css 缺 ${t}（尺寸/间距要有一个来源，不能各写各的字面量）`)
  }
})

test('el-icon 全局 flex:none —— flex 行里不许把图标压到比字号还小', () => {
  const block = css.slice(css.indexOf('.el-icon {'))
  assert.match(block.slice(0, 120), /flex:\s*none/, '.el-icon 需要 flex:none，否则窄栏里图标会被挤扁')
})

// ── ② 同一行/同一列只用一套图标 ──────────────────────────────────
test('菜单与导航里不再出现实心图标（*Filled）—— 整套线框', () => {
  for (const [name, src] of [['menus.js', menus], ['LeftNav.vue', nav], ['NoticeCenter.vue', notice]]) {
    const hits = [...stripComments(src).matchAll(/'([A-Za-z]*Filled)'/g)].map((m) => m[1])
    assert.deepEqual(hits, [], `${name} 里还有实心图标：${hits.join(',')}（同一行列只允许线框；实心只留给身份/状态标识）`)
  }
})

test('顶栏的实心图标只允许「已认证」那个状态勾（唯一的例外）', () => {
  const ALLOW = new Set(['CircleCheckFilled'])
  const src = stripComments(topbar)
  const used = new Set([...src.matchAll(/<([A-Z][A-Za-z]*Filled)\s*\/>/g)].map((m) => m[1]))
  const extra = [...used].filter((n) => !ALLOW.has(n))
  assert.deepEqual(extra, [], `顶栏出现了新的实心图标：${extra.join(',')}（功能入口一律线框；要加例外先想清楚它是不是"身份/状态"）`)
})

// ── ③ 命中区与尺寸走 token ───────────────────────────────────────
test('纯图标按钮的命中区与图标尺寸走 token（32 命中区 / 16 图标）', () => {
  for (const [name, src, sel] of [['TopBar.vue', topbar, '.bar-icon'], ['NoticeCenter.vue', notice, '.nc-ref']]) {
    const at = src.indexOf(sel + ' {')
    assert.ok(at >= 0, `${name} 找不到 ${sel} 样式块`)
    const block = src.slice(at, src.indexOf('}', at))
    assert.match(block, /var\(--ic-hit/, `${sel} 的宽高要用 var(--ic-hit)（antd 控件高 32），不要写死`)
    assert.match(block, /var\(--ic-main/, `${sel} 的字号要用 var(--ic-main)（16），不要写死`)
  }
})

test('附属符号（展开箭头）走弱化色，不许与标签同色', () => {
  const at = nav.indexOf('.arrow {')
  assert.ok(at >= 0, 'LeftNav 找不到 .arrow 样式块')
  const block = nav.slice(at, nav.indexOf('}', at))
  assert.match(block, /var\(--ic-sub/, '.arrow 尺寸要用 var(--ic-sub)（12）')
  assert.match(block, /color:\s*var\(--t-text-[23]\)/, '.arrow 必须用次级/弱色 —— 一个纯提示箭头不该和标签一样黑')
})
