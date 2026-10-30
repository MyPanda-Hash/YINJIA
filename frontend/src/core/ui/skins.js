/**
 * skins.js —— 换肤（皮肤）定义与生效
 *
 * 【需求来源】用户 2026-10-30 口径:
 *   「根据这个插件 dsh-claude-style 的风格设计，给系统的换肤设计一套皮肤，可以切换系统的皮肤」
 *
 * 【设计基线】取自 dsh-claude-style 插件 docs/STYLE.md 的色卡规则:
 *   ① 一套皮肤 = 一个 **强调色(accent)** + 一个 **画布(canvas)** 家族，明暗各一份；
 *      明暗里所有中性色都由同一个种子派生 ⇒ 不存在"暖强调 + 冷灰"的拼凑感；
 *   ② 永不纯黑、永不冷灰：暖砂的墨色是 `#161616` 而不是 `#000`，冷灰带一点蓝/绿；
 *   ③ 强调色只上"少量链接与焦点"（占可见元素 <10%），正文一律用墨色阶 ⇒ 表格里
 *      满屏数字不刺眼，眼睛知道该看哪里；
 *   ④ 强调色同时驱动 Element Plus 的 primary 阶梯（light-3/5/7/8/9、dark-2），
 *      按钮、焦点环、选中态才会跟色卡一致。
 *
 * 【为什么颜色写在 skins.css 而不是这里】
 *   这些 token 全部是 CSS 自定义属性，浏览器只需解析一份样式表；写进 JS 再逐条
 *   `style.setProperty` 会在每次切皮肤时触发上千次样式重算。JS 只负责"点哪张色卡"，
 *   颜色本身是 CSS 里的字面量（与 dsh-claude-style 一致：页面出厂就带字面量，运行时不做派生）。
 *
 * 【校验】skins.test.js 会逐套皮肤核对 skins.css 里明/暗两块是否给全了下面这些 token，
 *   少一个都会以"界面掉回默认色"表现出来，而不会报错 —— 所以钉成断言。
 */

/** 三套皮肤（id 与 skins.css 里的 `html[data-skin="…"]` 一一对应，改造前先看这里） */
export const SKINS = [
  {
    id: 'claude',
    name: '暖砂',
    nameEn: 'Warm Sand',
    desc: '暖纸底 + 陶土强调',
    descEn: 'Warm paper with terracotta accent',
    accent: '#d97757',
    canvas: '#ffffff',
    canvasDark: '#191919',
  },
  {
    id: 'deepseek',
    name: '深海',
    nameEn: 'Deep Sea',
    desc: '冷白底 + 靛蓝强调',
    descEn: 'Cool white with indigo accent',
    accent: '#4d6bfe',
    canvas: '#fbfcff',
    canvasDark: '#13161d',
  },
  {
    id: 'jade',
    name: '松墨',
    nameEn: 'Pine Ink',
    desc: '原制造绿，最稳',
    descEn: 'The original manufacturing green',
    accent: '#116a5b',
    canvas: '#ffffff',
    canvasDark: '#18201d',
  },
]

export const DEFAULT_SKIN = 'claude'

/** localStorage 键（与 mes_dark / mes_collapsed 同族命名） */
export const SKIN_STORAGE_KEY = 'mes_skin'

/**
 * 每套皮肤在明暗两块里都必须给全的 token。
 * 少任何一个 ⇒ 该处界面停在上一套（或 Element 默认蓝）的色，肉眼可见但控制台无错。
 */
export const SKIN_CORE_TOKENS = [
  '--t-primary',
  '--t-primary-dark',
  '--t-tab-active',
  '--t-badge',
  '--t-navbar-bg',
  '--t-navbar-text',
  '--t-navbar-info',
  '--t-sidebar-bg',
  '--t-content-bg',
  '--t-card-bg',
  '--t-text-1',
  '--t-text-2',
  '--t-text-3',
  '--t-border',
  '--t-border-light',
  '--t-hover-bg',
  // 深色"底板"（首页欢迎条这类大块深色面）—— 2026-10-30 加：它是明色下唯一成片的大色块，
  // 写死就永远绿着，换肤会被这块盖住（实测明色换肤像素差异只有 0.18%，这块是主因）。
  '--t-plate-bg',
  '--t-plate-accent',
  '--el-color-primary',
  '--el-color-primary-light-3',
  '--el-color-primary-light-5',
  '--el-color-primary-light-7',
  '--el-color-primary-light-8',
  '--el-color-primary-light-9',
  '--el-color-primary-dark-2',
]

/** 暗色专属：Element Plus 的底色/文字/描边/填充四组，明色由 Element 自带默认值兜底 */
export const SKIN_DARK_TOKENS = [
  '--el-bg-color',
  '--el-bg-color-page',
  '--el-bg-color-overlay',
  '--el-text-color-primary',
  '--el-text-color-regular',
  '--el-text-color-secondary',
  '--el-text-color-placeholder',
  '--el-border-color',
  '--el-border-color-light',
  '--el-border-color-lighter',
  '--el-fill-color',
  '--el-fill-color-light',
  '--el-fill-color-lighter',
  '--el-fill-color-dark',
  '--el-fill-color-blank',
]

/** 认识的皮肤 id 透传，其余一律落回默认（localStorage 里可能是旧版/手改的脏值） */
export function normalizeSkin(id) {
  return SKINS.some((s) => s.id === id) ? id : DEFAULT_SKIN
}

/** 读本机记住的皮肤；读不到/被禁（隐私模式）时用默认 */
export function readSkin() {
  try {
    return normalizeSkin(localStorage.getItem(SKIN_STORAGE_KEY))
  } catch (e) {
    return DEFAULT_SKIN
  }
}

/**
 * 切换皮肤：只改 `<html data-skin>` 与 localStorage，颜色全由 skins.css 决定。
 * 返回真正生效的皮肤 id（脏值会被纠正，调用方可据此更新界面选中态）。
 */
export function applySkin(id) {
  const skin = normalizeSkin(id)
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.skin = skin
  }
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin)
  } catch (e) {
    /* 隐私模式/配额满：本机记不住，但当前会话仍然换得动 */
  }
  return skin
}

/** 按 id 取皮肤定义（色卡渲染用） */
export function skinById(id) {
  return SKINS.find((s) => s.id === normalizeSkin(id))
}
