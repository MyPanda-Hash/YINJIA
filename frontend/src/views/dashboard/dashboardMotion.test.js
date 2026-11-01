/**
 * dashboardMotion.test.js —— 常驻动画不许花 CPU，动效全局要能一键关掉
 *
 * 【由来】2026-10-30 用户口径：「系统的动画是否流畅，卡顿的可以进行优化」。
 *   实测结论：交互路径本身是 60fps / 0 长任务（见汇报里的数字），真正的问题在**常驻**动画：
 *   首页那三颗"呼吸"圆点用 `animation` 逐帧改 `box-shadow`。box-shadow 不是合成属性，
 *   每帧都要重绘这个点和它外扩的一圈；三个点、2.6s 一轮、永不停止 ⇒ 用户在看任何页面时
 *   都背着一份重绘负载，弱机和远程桌面上就表现为"总觉得有点卡"，且和他在看什么无关。
 *   改法 = 把环挪到 `::after` 上做 `transform` + `opacity`（只走合成层，不重绘、不回流）。
 *
 * 【为什么钉成测试】这类退化**永远不会报错**：改回 box-shadow 界面长得一模一样，
 *   只有性能面板或用户的手感能发现。钉住"infinite 的动画只能动合成属性"就够了。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dashSrc = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const indexCss = readFileSync(new URL('../../styles/index.css', import.meta.url), 'utf8')

/** 剥掉块注释：注释里会出现 "禁 transition: all" 这类说明，不能当成声明来判 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')

/** 取出源码里所有 @keyframes 的 {名字: 声明体}（按大括号配对，不靠正则贪婪） */
function keyframeBodies(src) {
  const map = new Map()
  const re = /@keyframes\s+([\w-]+)\s*\{/g
  let m
  while ((m = re.exec(src))) {
    const start = re.lastIndex - 1
    let depth = 0
    let i = start
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}' && --depth === 0) break
    }
    map.set(m[1], src.slice(start + 1, i))
  }
  return map
}

/** 声明体里出现的 CSS 属性名 */
const propsOf = (body) => [...body.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1])

// ── ① 常驻动画只能动合成属性 ─────────────────────────────────────
test('首页所有 infinite 动画只动 transform / opacity（不逐帧重绘）', () => {
  const css = stripComments(dashSrc)
  const frames = keyframeBodies(css)
  // 找出所有 `animation: <name> ... infinite` 用到的 keyframes 名
  const loops = new Set()
  for (const m of css.matchAll(/animation:\s*([\w-]+)[^;{}]*\binfinite\b/g)) loops.add(m[1])
  assert.ok(loops.size > 0, '首页应当还有呼吸点动画；一个都找不到说明断言写法过期了，请同步更新')
  const allowed = new Set(['transform', 'opacity'])
  for (const name of loops) {
    const body = frames.get(name)
    assert.ok(body, `找不到 @keyframes ${name}（引用了不存在的动画名，浏览器会静默忽略）`)
    for (const prop of propsOf(body)) {
      assert.ok(allowed.has(prop),
        `常驻动画 @keyframes ${name} 动了 ${prop}：只允许 transform / opacity（其余属性每帧都要重绘，永不停止的动画会变成常驻负载）`)
    }
  }
})

test('旧的 box-shadow 脉冲 keyframes 已清除（同名重复定义会互相覆盖，改哪个都可能改不到）', () => {
  const css = stripComments(dashSrc)
  assert.ok(!/@keyframes\s+live-pulse\b/.test(css), 'live-pulse 已改成 live-ring，别再留一份定义')
  assert.ok(!/@keyframes\s+event-pulse\b/.test(css), 'event-pulse 已改成 live-ring，别再留一份定义')
})

// ── ② 全局 reduced-motion ────────────────────────────────────────
test('index.css 里有全局 prefers-reduced-motion 兜底', () => {
  assert.match(indexCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    '系统级"减少动效"必须全局兜底，否则新组件会漏、弱机用户关不掉补间')
  const block = indexCss.slice(indexCss.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(block, /animation-duration:\s*0?\.01ms\s*!important/, '要压住 animation')
  assert.match(block, /transition-duration:\s*0?\.01ms\s*!important/, '要压住 transition')
})

// ── ③ 全仓不许 transition: all ──────────────────────────────────
test('全仓没有 transition: all（项目红线：hover 会把会回流的属性也纳入补间）', () => {
  const bad = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) { walk(p); continue }
      if (!/\.(vue|css)$/.test(name)) continue
      const txt = stripComments(readFileSync(p, 'utf8'))
      if (/transition:\s*all\b/.test(txt)) bad.push(p)
    }
  }
  walk(new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  assert.deepEqual(bad, [], `这些文件还有 transition: all → ${bad.join(', ')}`)
})
