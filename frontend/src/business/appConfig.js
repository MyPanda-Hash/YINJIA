/**
 * appConfig.js — App 壳的运行时配置(2026-10-21)
 *
 * 为什么单独一个文件:App 里前端是打包进 APK 的静态资源,没有 Vite dev server 代理,
 * 所有请求必须打到**后端的绝对地址**。改服务器只改这一处。
 *
 * 环境判定:
 *   · isNative()  —— 是否跑在 Capacitor 壳里(App)。浏览器里恒为 false。
 *   · apiBase()   —— 后端基地址。App 内用 apiOrigin,浏览器内用空串(走 vite 代理 /api)。
 */

/**
 * 默认后端地址(公网服务器)。用户可在 App 内「设置服务器地址」覆盖(见 apiOrigin())。
 *
 * 为什么做成可覆盖:2026-10-21 验证阶段要在「本机局域网」与「公网服务器」之间来回切,
 * 每切一次都要重新打包太慢(打包约 1 分钟 + 装机)。改成运行时可改、存在本地,
 * 一次装机就能反复验证;正式上线后仍可用默认值,不影响。
 */
export const API_ORIGIN = 'http://36.140.66.163:8090'

/** 本地存储键:App 内设置的服务器地址 */
export const API_ORIGIN_KEY = 'mes_api_origin'

/**
 * 当前生效的后端地址。
 *
 * <p>🔴 2026-11-01 修:**原生存在 SharedPreferences 的地址要优先**。
 * <p>原来的坑:顶部原生工具条「设置」写的是 SharedPreferences(`YjNative.getBaseUrl()`),
 * 而这里只读 localStorage ⇒ **两套存储互不相认**:用户在原生条改的地址,网页根本不认,
 * 请求还按 localStorage 里的旧值(或默认公网地址)发出去。
 * 这也正是用户看到"上下两个连接设置"却改哪个都不对劲的根因。
 *
 * <p>取值优先级(改地址只需改一处 = 顶部原生条的「设置」):
 * <ol>
 *   <li>**原生 `YjNative.getBaseUrl()`** —— 壳内唯一真源;</li>
 *   <li>localStorage(网页版 / 老装机升级后的兼容值);</li>
 *   <li>默认值 {@link API_ORIGIN}。</li>
 * </ol>
 *
 * @returns {string} 形如 http://192.168.0.238:8090(不带尾斜杠)
 */
export function apiOrigin() {
  // ① 壳内:读原生 SharedPreferences(顶部工具条「设置」写的就是它)
  try {
    const nat = typeof window !== 'undefined' && window.YjNative
      && typeof window.YjNative.getBaseUrl === 'function'
      ? String(window.YjNative.getBaseUrl() || '').trim()
      : ''
    if (nat && /^https?:\/\//i.test(nat)) return nat.replace(/\/+$/, '')
  } catch { /* 桥不可用时继续往下退 */ }
  // ② localStorage
  try {
    const saved = localStorage.getItem(API_ORIGIN_KEY)
    if (saved && /^https?:\/\//i.test(saved.trim())) return saved.trim().replace(/\/+$/, '')
  } catch { /* 无 localStorage 时用默认 */ }
  return API_ORIGIN
}

/**
 * 保存自定义服务器地址(传空串 = 恢复默认)。
 *
 * <p>🔴 2026-11-01:壳内要**同时写原生**(`YjNative.setBaseUrl`)。
 * 因为 {@link apiOrigin} 现在优先读原生 SharedPreferences —— 只写 localStorage 会"改了不生效"
 * (下次读还是原生里的旧值),这种"看起来保存成功、实际没变"的坑最难查。
 *
 * @param {string} v 形如 http://192.168.1.10:8090(传空串恢复默认)
 * @returns {boolean} 是否成功
 */
export function setApiOrigin(v) {
  try {
    const s = String(v == null ? '' : v).trim().replace(/\/+$/, '')
    if (!s) {
      localStorage.removeItem(API_ORIGIN_KEY)
      try {
        if (window.YjNative && typeof window.YjNative.setBaseUrl === 'function') {
          window.YjNative.setBaseUrl('')
        }
      } catch { /* 桥没实现就算了 */ }
    } else {
      localStorage.setItem(API_ORIGIN_KEY, s)
      try {
        if (window.YjNative && typeof window.YjNative.setBaseUrl === 'function') {
          window.YjNative.setBaseUrl(s)
        }
      } catch { /* 桥没实现就算了 */ }
    }
    return true
  } catch {
    return false
  }
}

/**
 * 是否运行在**原生壳**里(APK 内)。
 *
 * <p>🔴 2026-11-01 修:原来只认 Capacitor,漏了本仓库实际使用的**手搓壳 `window.YjNative`**。
 * <p>后果(实测踩到):手搓壳里 `isNative()` 返回 false ⇒ `apiBase()` 返回空串 ⇒
 * axios 的 baseURL 变成相对路径 `/api`;而 APK 页面跑在 `file:///android_asset/www/` 下,
 * 相对路径会解析成 `file:///api/...` ⇒ **所有接口必然失败**,界面上表现就是
 * 「工厂信息加载失败,请检查服务后重试」。这不是网络问题,是取址逻辑认错了壳。
 *
 * <p>三种壳都要认:
 * <ol>
 *   <li>Capacitor(`window.Capacitor`);</li>
 *   <li>**手搓壳(`window.YjNative`)—— 本仓库 android/ 用的就是它**;</li>
 *   <li>直接用 `file://` 打开(兜底,同样没有同源后端)。</li>
 * </ol>
 *
 * @returns {boolean}
 */
export function isNative() {
  try {
    if (typeof window === 'undefined') return false
    // ① 手搓壳:有 YjNative 桥就一定是 APK 内
    if (window.YjNative) return true
    // ② Capacitor 壳:有对象且平台名不是 web
    const cap = window.Capacitor
    if (cap) {
      if (typeof cap.isNativePlatform === 'function') return !!cap.isNativePlatform()
      const p = typeof cap.getPlatform === 'function' ? cap.getPlatform() : ''
      if (p && p !== 'web') return true
    }
    // ③ 兜底:file:// 打开 = 打包进壳的静态页
    return typeof location !== 'undefined' && location.protocol === 'file:'
  } catch {
    return false
  }
}

/**
 * 请求基地址。
 * App 内:apiOrigin()(绝对地址,因为 APK 内没有代理;可被 App 内设置覆盖)
 * 浏览器:''(相对路径,走 vite/后端同源的 /api)
 *
 * @returns {string}
 */
export function apiBase() {
  return isNative() ? apiOrigin() : ''
}
