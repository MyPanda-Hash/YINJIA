/**
 * skins.test.js —— 换肤（皮肤）体系的三条不可回退点
 *
 * 【需求来源】用户 2026-10-30 口径:
 *   「根据这个插件 dsh-claude-style 的风格设计，给系统的换肤设计一套皮肤，可以切换系统的皮肤」
 *
 * 【设计基线】dsh-claude-style 的令牌规则（该插件 docs/STYLE.md）:
 *   ① 一套皮肤 = 一个 **强调色 + 画布家族** 的"色卡"，明暗各一份，同一套色卡里
 *      颜色全部由这两个种子派生 ⇒ 不允许出现"冷灰配暖强调"这种拼凑；
 *   ② 永不纯黑、永不冷灰；强调色占可见元素 10% 以内 ⇒ 正文用墨色，强调只给少量链接/焦点；
 *   ③ 边框 1px、分隔线大半档更浅；圆角 4/8/16 阶梯；间距 4px 节奏；
 *   ④ 明暗两套都必须给全，缺一个 token 界面就会掉出半截默认绿 ⇒ 这里是**硬校验**。
 *
 * 【为什么用源码断言】
 *   皮肤是纯声明数据（CSS 变量），没有可观察的业务行为；真跑一遍要开浏览器数像素。
 *   真正会被人顺手改坏的是:皮肤漏定义某个 token（界面半绿半新）、色卡强调色与按钮
 *   颜色脱钩（点色卡换的不是那个颜色）、CSS 里留了一个 JS 已删除的皮肤 id（选择器
 *   永远不生效）。这三件事都不报错，只影响观感 ⇒ 钉成断言。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  SKINS,
  DEFAULT_SKIN,
  SKIN_STORAGE_KEY,
  SKIN_CORE_TOKENS,
  SKIN_DARK_TOKENS,
  normalizeSkin,
  readSkin,
  applySkin,
} from './skins.js'

const css = readFileSync(new URL('../../styles/skins.css', import.meta.url), 'utf8')
const mainSrc = readFileSync(new URL('../../main.js', import.meta.url), 'utf8')
const htmlSrc = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8')

/** 取 `html[data-skin="x"]` / `html[data-skin="x"].dark` 花括号里的内容 */
function cssBlock(selector) {
  const at = css.indexOf(selector + ' {')
  assert.ok(at >= 0, `skins.css 缺少选择器 ${selector} {`)
  const start = css.indexOf('{', at) + 1
  const end = css.indexOf('}', start)
  assert.ok(end > start, `${selector} 的花括号没有闭合`)
  return css.slice(start, end)
}

/** 一个块里声明的所有自定义属性名 */
function declaredTokens(block) {
  return new Set((block.match(/--[a-z0-9-]+(?=\s*:)/g) || []))
}

// ── ① 皮肤定义本身 ───────────────────────────────────────────────
test('皮肤清单：至少 3 套、id 唯一、色卡三色齐全', () => {
  assert.ok(SKINS.length >= 3, '一套皮肤至少 3 套可选（暖砂 / 深海 / 松墨）')
  const ids = SKINS.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length, `皮肤 id 不能重复：${ids.join(',')}`)
  for (const s of SKINS) {
    assert.match(s.id, /^[a-z][a-z0-9-]*$/, `皮肤 id 只能用小写字母与连字符：${s.id}`)
    assert.ok(s.name && s.nameEn, `${s.id} 缺中文名或英文名`)
    for (const k of ['accent', 'canvas', 'canvasDark']) {
      assert.match(s[k], /^#[0-9a-f]{6}$/i, `${s.id}.${k} 必须是 6 位十六进制色值，实际 ${s[k]}`)
    }
  }
  assert.ok(ids.includes(DEFAULT_SKIN), '默认皮肤必须在清单里')
})

test('normalizeSkin：认识的透传，不认识/脏值落回默认皮肤', () => {
  assert.equal(normalizeSkin('deepseek'), 'deepseek')
  for (const bad of ['', null, undefined, 'nope', 123, {}]) {
    assert.equal(normalizeSkin(bad), DEFAULT_SKIN, `${String(bad)} 应落回 ${DEFAULT_SKIN}`)
  }
})

// ── ② 落盘与生效 ─────────────────────────────────────────────────
test('applySkin 写 data-skin 与 localStorage；没有 document 时也不炸', () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }
  const root = { dataset: {} }
  globalThis.document = { documentElement: root }

  try {
    assert.equal(applySkin('deepseek'), 'deepseek')
    assert.equal(root.dataset.skin, 'deepseek', '皮肤必须落在 <html data-skin>')
    assert.equal(store.get(SKIN_STORAGE_KEY), 'deepseek', '皮肤要记住，刷新后还在这套')

    assert.equal(readSkin(), 'deepseek')
    assert.equal(applySkin('不存在的皮肤'), DEFAULT_SKIN, '脏值要落回默认皮肤，不能把界面留在无皮肤状态')

    delete globalThis.document
    assert.equal(applySkin('jade'), 'jade', '没有 document（SSR / 单测）时不能抛错')
  } finally {
    delete globalThis.document
    delete globalThis.localStorage
  }
})

// ── ③ CSS 与 JS 必须一致 ─────────────────────────────────────────
test('每套皮肤在 skins.css 都有明暗两块，且 token 一个不少', () => {
  for (const s of SKINS) {
    const light = cssBlock(`html[data-skin="${s.id}"]`)
    const dark = cssBlock(`html[data-skin="${s.id}"].dark`)
    const tl = declaredTokens(light)
    const td = declaredTokens(dark)
    for (const t of SKIN_CORE_TOKENS) {
      assert.ok(tl.has(t), `html[data-skin="${s.id}"] 缺 ${t}（明色界面会掉回默认色）`)
      assert.ok(td.has(t), `html[data-skin="${s.id}"].dark 缺 ${t}（暗色界面会掉回默认色）`)
    }
    for (const t of SKIN_DARK_TOKENS) {
      assert.ok(td.has(t), `html[data-skin="${s.id}"].dark 缺 ${t}（Element 深色变量不全）`)
    }
  }
})

test('skins.css 里不能留 JS 已删除的皮肤 id（选择器永不生效）', () => {
  const ids = new Set(SKINS.map((s) => s.id))
  const used = new Set([...css.matchAll(/html\[data-skin="([^"]+)"\]/g)].map((m) => m[1]))
  assert.ok(used.size > 0, 'skins.css 里一个皮肤选择器都没有')
  for (const id of used) assert.ok(ids.has(id), `skins.css 有 ${id}，但 SKINS 里没有这套皮肤`)
})

test('色卡的强调色 = 界面按钮的强调色（点哪个色卡换的就是哪个颜色）', () => {
  for (const s of SKINS) {
    const light = cssBlock(`html[data-skin="${s.id}"]`)
    const m = light.match(/--el-color-primary:\s*(#[0-9a-f]{6})/i)
    assert.ok(m, `html[data-skin="${s.id}"] 必须显式给 --el-color-primary`)
    assert.equal(m[1].toLowerCase(), s.accent.toLowerCase(), `${s.id} 的色卡色与实际按钮色不一致`)
  }
})

// ── ④ 加载顺序：皮肤必须在 :root 默认值之后 ────────────────────────
test('main.js 先引入 index.css 再引入 skins.css（否则默认绿会盖住皮肤）', () => {
  const i1 = mainSrc.indexOf("import './styles/index.css'")
  const i2 = mainSrc.indexOf("import './styles/skins.css'")
  assert.ok(i1 >= 0, 'main.js 找不到 index.css 的引入')
  assert.ok(i2 >= 0, 'main.js 必须引入 skins.css，否则皮肤切换没有任何样式变化')
  assert.ok(i2 > i1, 'skins.css 必须排在 index.css 之后引入')
})

test('index.html 的首帧预置皮肤清单与 SKINS 一致', () => {
  // index.html 里那段内联脚本在**主包 CSS 到达之前**就挂 data-skin，
  // 目的是不让用户先看到默认皮肤再跳一下。它必须跟着 SKINS 改，否则新皮肤第一帧会闪。
  for (const s of SKINS) {
    assert.ok(htmlSrc.includes(`'${s.id}'`), `index.html 的首帧白名单缺 ${s.id}（新皮肤第一帧会闪成默认皮）`)
  }
  assert.ok(htmlSrc.includes(`: '${DEFAULT_SKIN}'`), `index.html 的兜底皮肤必须是 DEFAULT_SKIN(${DEFAULT_SKIN})`)
})
