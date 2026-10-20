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

/** 后端服务器地址(车间/厂内网用这个;换服务器改这里) */
export const API_ORIGIN = 'http://36.140.66.163:8090'

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
 * App 内:API_ORIGIN(绝对地址,因为 APK 内没有代理)
 * 浏览器:''(相对路径,走 vite/后端同源的 /api)
 *
 * @returns {string}
 */
export function apiBase() {
  return isNative() ? API_ORIGIN : ''
}
