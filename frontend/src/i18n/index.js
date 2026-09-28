import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
// 语言包按需加载(2026-09-28 性能优化:11 个包 ~1.1MB 全静态打入主包)。
// zh-CN 是源语言+回退语言,恒驻;其余包 ensureLocalePack() 动态 import 独立 chunk。
import zhCN from './locales/zh-CN'

/** Supported locales at build time(zh-CN 恒在首位;其余来自后端 yj_locale 注册表动态扩展)。 */
export const SUPPORTED = ['zh-CN', 'zh-TW', 'en']

/** localStorage key for the anonymous/local fallback preference. */
export const LOCALE_KEY = 'mes_locale'

/** Default locale when nothing is saved and the browser gives no signal. */
export const DEFAULT_LOCALE = 'zh-CN'

/**
 * Resolve the initial locale: saved preference wins, then browser language,
 * then the default. Per-user memory (yj_user.locale) is applied by the locale
 * store after login once the backend endpoint lands (P3).
 */
export function detectLocale() {
  try {
    const saved = localStorage.getItem(LOCALE_KEY)
    if (saved && SUPPORTED.includes(saved)) return saved
  } catch { /* localStorage unavailable — fall through */ }
  const nav = String(navigator.language || '').toLowerCase()
  if (nav.startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

/** 有本地静态语言包的 locale(动态 import 的映射表;vite 据此为每个包建独立 chunk)。 */
const PACKS = {
  'zh-TW': () => import('./locales/zh-TW'),
  en: () => import('./locales/en'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  ru: () => import('./locales/ru'),
  vi: () => import('./locales/vi'),
  th: () => import('./locales/th'),
}

/** 已带静态语言包的 locale(切换即生效,不依赖机翻)。 */
export const STATIC_PACKED = ['zh-CN', ...Object.keys(PACKS)]

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { 'zh-CN': zhCN },
})

/* ---- 语言包按需加载 ----
 * 已加载的去重;并发调用共享同一 Promise(先占位后回填,失败时清除以便重试)。
 * zh-CN 恒在(源语言),无包语言(后端 yj_locale 扩展)直接空手而归——词条走
 * tt() 的 miss → ensureDict 机翻管线,与既有机制无缝衔接。
 */
const packLoaded = new Set(['zh-CN'])
const packLoading = new Map()

export async function ensureLocalePack(locale) {
  if (!locale || locale === 'zh-CN' || locale === 'zh' || packLoaded.has(locale)) return
  let p = packLoading.get(locale)
  if (!p) {
    const loader = PACKS[locale]
    p = loader
      ? loader().then((mod) => { i18n.global.mergeLocaleMessage(locale, mod.default || {}) })
          .then(() => { packLoaded.add(locale) })
          .catch((e) => { console.warn('[i18n] 语言包加载失败:', locale, e) })
          .finally(() => { packLoading.delete(locale) })
      : Promise.resolve() // 无本地包的动态语言:交给机翻管线
    packLoading.set(locale, p)
  }
  await p
}

/**
 * 业务直译 helper(全局语言切换,ADR-0001:仅显示层):
 * 中文界面原样返回;其他语言按中文原文查 biz 词典(静态包或后端动态 merge),
 * 命中返回译文,未命中原样返回。用于菜单标题、按钮名、状态值等"中文即键"的
 * 显示点——仅用于显示,提交给后端的键(buttonName/dataName)保持中文原值。
 *
 * 未命中词条自动记入待取集合(recordMiss),去抖批量经注册的取词器补齐
 * (main.js 注册为 locale store 的 ensureDict:/locale/dict 机翻 + 库表词典),
 * merge 后自增 dictVersion 触发调用处重渲——渲染函数/computed 内的 tt() 天然响应。
 * 对齐 light-mes:切换语言后所有字段/面板/按钮自动机翻,无需预置翻译。
 */
export function tt(text) {
  if (typeof text !== 'string' || !text) return text
  const current = i18n.global.locale.value
  if (!current || current === 'zh-CN' || current === 'zh') return text
  // 组合标题(如"基础资料 / 客户档案")按分隔符逐段翻译后回拼
  if (text.includes(' / ')) return text.split(' / ').map((seg) => tt(seg)).join(' / ')
  void dictVersion.value // 建立响应式依赖:词条补齐后自动重渲
  const locale = i18n.global.locale.value
  const dict = i18n.global.getLocaleMessage(locale)?.biz || {}
  const hit = dict[text]
  if (hit) return hit
  recordMiss(locale, text)
  return text
}

/* ---- 缺失词条自动补齐(所有语言通用,移植自 light-mes) ----
 * tt() 渲染时发现缺失 → 记入 pendingByLocale → 去抖 500ms 批量调取词器
 * (ensureDict:/locale/dict 机翻 + 翻译表) → mergeLocaleMessage → dictVersion++ 触发重渲。
 * requested 集合按「locale+键」去重:机翻失败的键本会话不再重试,防请求风暴。
 */
export const dictVersion = ref(0)

const PENDING_DELAY = 500
const pendingByLocale = new Map() // locale -> Set<key>
const requested = new Set() // `${locale} ${key}`
let fetcher = null
let timer = 0

/** main.js 安装 pinia 后注册:注入 ensureDict,避免 i18n 依赖业务层 */
export function registerDictFetcher(fn) {
  fetcher = fn
}

function recordMiss(locale, key) {
  if (!fetcher || !key || key.length > 200) return
  const rid = locale + '\u0000' + key
  if (requested.has(rid)) return
  requested.add(rid)
  let set = pendingByLocale.get(locale)
  if (!set) pendingByLocale.set(locale, (set = new Set()))
  set.add(key)
  if (!timer) timer = setTimeout(flushPending, PENDING_DELAY)
}

async function flushPending() {
  timer = 0
  const locale = i18n.global.locale.value
  const set = pendingByLocale.get(locale)
  if (!fetcher || !set || !set.size) return
  const keys = [...set]
  set.clear()
  try {
    await fetcher(locale, keys)
  } catch (e) {
    /* 翻译服务不可用:tt() 回退原文 */
  }
  dictVersion.value++
}
