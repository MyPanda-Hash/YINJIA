import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import ja from './locales/ja'
import ko from './locales/ko'
import es from './locales/es'
import fr from './locales/fr'
import de from './locales/de'
import ru from './locales/ru'
import vi from './locales/vi'
import th from './locales/th'

/** Supported locales at build time(zh-CN 恒在首位;其余来自后端 yj_locale 注册表动态扩展)。 */
export const SUPPORTED = ['zh-CN', 'en']

/** 业务直译词典的全部中文原文键(供后端 /api/locale/dict 机翻新语言)。 */
export const BIZ_KEYS = Object.keys(en.biz || {})

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

/** 已带静态语言包的 locale(切换即生效,不依赖机翻)。 */
export const STATIC_PACKED = ['zh-CN', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    en,
    ja,
    ko,
    es,
    fr,
    de,
    ru,
    vi,
    th,
  },
})

/**
 * 业务直译 helper(全局语言切换,ADR-0001:仅显示层):
 * 中文界面原样返回;其他语言按中文原文查 biz 词典(静态包或后端动态 merge),
 * 命中返回译文,未命中原样返回。用于菜单标题、按钮名、状态值等"中文即键"的
 * 显示点——仅用于显示,提交给后端的键(buttonName/dataName)保持中文原值。
 */
export function tt(text) {
  if (typeof text !== 'string' || !text) return text
  const current = i18n.global.locale.value
  if (!current || current === 'zh-CN' || current.startsWith('zh')) return text
  // 组合标题(如"基础资料 / 客户档案")按分隔符逐段翻译后回拼
  if (text.includes(' / ')) return text.split(' / ').map((seg) => tt(seg)).join(' / ')
  const key = 'biz.' + text
  const translated = i18n.global.t(key)
  return translated === key ? text : translated
}
