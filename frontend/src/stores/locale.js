import { defineStore } from 'pinia'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import ja from 'element-plus/es/locale/lang/ja'
import ko from 'element-plus/es/locale/lang/ko'
import es from 'element-plus/es/locale/lang/es'
import fr from 'element-plus/es/locale/lang/fr'
import de from 'element-plus/es/locale/lang/de'
import ru from 'element-plus/es/locale/lang/ru'
import { i18n, LOCALE_KEY, BIZ_KEYS } from '@/i18n'

/** Element Plus 组件库文案 locale 映射(缺失语言回退英文)。 */
const EP_LOCALES = { 'zh-CN': zhCn, en, ja, ko, es, fr, de, ru }

/** 静态内置语言(有本地语言包);其余语言由后端 yj_locale 注册表动态提供。 */
const BUILTIN = [
  { locale: 'zh-CN', nameNative: '简体中文' },
  { locale: 'en', nameNative: 'English' },
]

/**
 * Locale store — 语言切换的唯一真源(决策见 CONTEXT.md)。
 * 动态语言:available 列表来自 /api/locale/list(yj_locale 表,加行即扩语言);
 * 非内置语言的 biz 词典由 /api/locale/dict 机翻(阿里云)兜底并 merge 进 i18n。
 */
export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: (() => {
      try {
        const saved = localStorage.getItem(LOCALE_KEY)
        if (saved) return saved
      } catch { /* ignore */ }
      return 'zh-CN'
    })(),
    available: BUILTIN,
    dictLoaded: {},
  }),
  getters: {
    epLocale: (s) => EP_LOCALES[s.locale] ?? en,
    shortLabel: (s) => (s.locale === 'en' ? 'EN' : s.locale === 'zh-CN' ? '中' : (s.locale.split('-')[0] || '').toUpperCase()),
    isChinese: (s) => !s.locale || s.locale === 'zh-CN' || s.locale.startsWith('zh'),
  },
  actions: {
    apply() {
      i18n.global.locale.value = this.locale
      document.documentElement.setAttribute('lang', this.locale)
      const names = { 'zh-CN': '生产制造执行系统', en: 'Manufacturing Execution System' }
      document.title = 'YINJIA-MES · ' + (names[this.locale] ?? tt0(this.locale, '生产制造执行系统'))
    },
    /** 拉取启用语言列表(切换器数据源;失败回退内置两语)。 */
    async loadAvailable() {
      try {
        const r = await fetch('/api/locale/list')
        const d = await r.json()
        if (Array.isArray(d?.data) && d.data.length) this.available = d.data
      } catch { /* 保持内置 */ }
    },
    /** 外语词典保障:静态包已覆盖的词跳过,缺失的词请求后端
     *  (翻译表命中或机翻)merge 进 i18n——静态包语言同样受益于机翻补缺。 */
    async ensureDict(locale) {
      if (!locale || locale.startsWith('zh')) return
      if (this.dictLoaded[locale]) return
      this.dictLoaded[locale] = true
      try {
        // 只请求静态包没有的词条,避免机翻结果覆盖静态包的人工翻译
        const existing = i18n.global.getLocaleMessage(locale)?.biz || {}
        const missing = BIZ_KEYS.filter((k) => !(k in existing))
        if (!missing.length) return
        const r = await fetch('/api/locale/dict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale, keys: missing }),
        })
        const d = await r.json()
        const dict = d?.data?.dict
        if (dict && Object.keys(dict).length) {
          i18n.global.mergeLocaleMessage(locale, { biz: dict })
        }
      } catch { /* 词典加载失败时 tt() 回退原文 */ }
    },
    async set(locale) {
      if (!locale || locale === this.locale) return
      this.locale = locale
      try { localStorage.setItem(LOCALE_KEY, locale) } catch { /* ignore */ }
      this.apply()
      // 纯 SPA 热切换:不刷新页面、不重置任何页面状态。
      // - UI 文案:tt()/t() 响应式,i18n locale 切换即全局重渲染;
      // - 机翻词典:后台补缺,merge 后由 vue-i18n 响应式自动更新;
      // - 面板字段标签/面板名:由 PanelxList/PanelxForm 监听 locale 重新拉取配置,
      //   数据、分页、弹窗、滚动、表单输入全部保留。
      this.ensureDict(locale)
    },
    /** 循环切换(Alt+L 快捷键入口)。 */
    cycle() {
      const list = this.available.map((a) => a.locale)
      const pool = list.length > 1 ? list : ['zh-CN', 'en']
      this.set(pool[(pool.indexOf(this.locale) + 1) % pool.length] || 'zh-CN')
    },
  },
})

/** 独立小翻译(document.title 用,不依赖组件上下文)。 */
function tt0(locale, text) {
  if (!locale || locale === 'zh-CN' || locale.startsWith('zh')) return text
  const key = 'biz.' + text
  const tr = i18n.global.t(key)
  return tr === key ? text : tr
}
