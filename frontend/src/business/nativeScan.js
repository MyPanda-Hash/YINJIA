/**
 * nativeScan.js — 原生相机扫码封装(2026-10-21 建,**2026-11-17 重写:只走 YjNative 桥**)
 *
 * 【2026-11-17 报障:扫码混料点「相机扫码」弹 "This plugin method is not available on this platform."】
 *
 * 原实现:`isNative()` 为真 → 动态 `import('@capacitor-mlkit/barcode-scanning')` → `BarcodeScanner.scan()`。
 * 但手机上跑的 App 是**手搓壳**(只注入 `window.YjNative`,底层是自研 ScanActivity + ZXing),
 * **没有装 Capacitor 的 ML Kit 原生插件** ⇒ 插件的 JS 打进了包、原生实现缺席 ⇒ 一调必抛上面那句。
 * 更糟的是 `isNative()` 只要看到 `window.YjNative` 就返回 true(2026-11-01 修 apiBase 时改的),
 * 于是「只在 App 里显示」的相机按钮照样显示出来 —— 用户看得见、点下去必然报错。
 *
 * 现在与「生产领料 / 生产扫码登记 / 其他领料」**完全同一条调用**(用户口径
 * 「相机和其他扫码用一样的调用就可以」):
 *
 *   window.YjNative.scan()  → 原生 ScanActivity 扫码 → window.__yjScanResult(code, ok)
 *
 * ML Kit 方案彻底不用(国内无 GMS 机型本来就扫不了;生产领料 2026-10-21 已移除)。
 * 网页版没有这个桥 ⇒ {@link hasNativeScan} 为 false ⇒ 页面不显示扫码按钮,只留
 * 输入框 + 查询(扫码枪/手输),不会再有"点了报错"的空按钮。
 */

/** 等原生回传结果的兜底超时:相机权限被拒时壳只弹 Toast、不回调,不能让调用方永远转圈 */
const SCAN_TIMEOUT_MS = 120000

/**
 * 本机是否具备原生扫码能力。
 *
 * <p>判据只有一条:壳注入了 `window.YjNative.scan`。
 * **不要**再用 `isNative()` —— 它表示"跑在壳里"(含 file:// 兜底),不代表壳里有扫码实现。
 *
 * @returns {boolean}
 */
export function hasNativeScan() {
  try {
    return typeof window !== 'undefined'
      && !!(window.YjNative && typeof window.YjNative.scan === 'function')
  } catch {
    return false
  }
}

/**
 * 扫一个码(调起原生相机,扫完即回)。
 *
 * <p>`opt.formats` 仅为调用方兼容保留 —— 原生 ScanActivity 自己决定码制(二维码 + 常见一维码),
 * 前端传什么都不影响,别照抄成"这里能限定码制"。
 *
 * @param {{ formats?: string[] }} [opt]
 * @returns {Promise<{ ok: boolean, text?: string, reason?: 'not-native'|'cancelled'|'denied'|'error'|'empty'|'timeout', message?: string }>}
 */
export function scanOnce(opt = {}) { // eslint-disable-line no-unused-vars
  if (!hasNativeScan()) return Promise.resolve({ ok: false, reason: 'not-native' })

  return new Promise((resolve) => {
    let settled = false

    const finish = (r) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      // 只清理自己挂的回调,别误删页面(如生产领料)自己注册的处理器
      try {
        if (window.__yjScanResult === handler) delete window.__yjScanResult
      } catch { /* ignore */ }
      resolve(r)
    }

    /** 壳回传:`__yjScanResult(code, ok)`;取消/没扫到时 code 为 ''、ok 为 false */
    const handler = (code, ok) => {
      const text = String(code == null ? '' : code).trim()
      if (!ok || !text) {
        finish({ ok: false, reason: 'cancelled' })
        return
      }
      finish({ ok: true, text })
    }

    const timer = setTimeout(
      () => finish({ ok: false, reason: 'timeout', message: '扫码超时' }),
      SCAN_TIMEOUT_MS,
    )

    window.__yjScanResult = handler
    try {
      window.YjNative.scan()
    } catch (e) {
      finish({ ok: false, reason: 'error', message: String((e && e.message) || e) })
    }
  })
}
