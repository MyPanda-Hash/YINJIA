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
 * 当前生效的后端地址:优先用 App 内设置过的,否则用默认。
 *
 * 只接受 http(s):// 开头的合法地址,防止误填导致所有请求打到相对路径。
 *
 * @returns {string} 形如 http://192.168.0.238:8090(不带尾斜杠)
 */
export function apiOrigin() {
  try {
    const saved = localStorage.getItem(API_ORIGIN_KEY)
    if (saved && /^https?:\/\//i.test(saved.trim())) return saved.trim().replace(/\/+$/, '')
  } catch { /* 无 localStorage 时用默认 */ }
  return API_ORIGIN
}

/** 保存自定义服务器地址(传空串 = 恢复默认) */
export function setApiOrigin(v) {
  try {
    const s = String(v == null ? '' : v).trim().replace(/\/+$/, '')
    if (!s) localStorage.removeItem(API_ORIGIN_KEY)
    else localStorage.setItem(API_ORIGIN_KEY, s)
    return true
  } catch {
    return false
  }
}

/**
 * 是否运行在 Capacitor 原生壳里。
 *
 * Capacitor 会在 window 上挂 Capacitor 对象,并带 isNativePlatform();
 * 但浏览器里某些构建也可能有该对象,故双重判定(必须有平台名且非 web)。
 *
 * @returns {boolean}
 */
export function isNative() {
  try {
    const cap = typeof window !== 'undefined' ? window.Capacitor : null
    if (!cap) return false
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform()
    const p = typeof cap.getPlatform === 'function' ? cap.getPlatform() : ''
    return !!p && p !== 'web'
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
