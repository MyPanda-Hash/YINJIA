/**
 * nativeScan.js — 原生扫码封装(2026-10-21)
 *
 * 目标:同一份页面代码,在 App 里调**原生相机**(MLKit),在浏览器里返回 null 让页面
 * 退回扫码枪/手输。这样 WorkOrderPick.vue 不必到处判断环境。
 *
 * 为什么 App 能扫而浏览器不能:
 *   浏览器 getUserMedia 要求安全上下文(HTTPS/localhost),服务器 http://36.140.66.163:8090
 *   不满足;而 App 内走的是 Android 原生相机 + MLKit,与页面协议无关。
 *
 * 依赖 @capacitor-mlkit/barcode-scanning 用**动态 import**:浏览器构建时不会把它打进主包,
 * 也不会因缺少原生模块而报错(浏览器里直接走 isNative() === false 分支)。
 */

import { isNative } from './appConfig'

/**
 * 扫一个码。
 *
 * @param {{ formats?: string[] }} [opt] 限定码制;默认二维码 + 常见一维码
 * @returns {Promise<{ ok: boolean, text?: string, reason?: 'not-native'|'cancelled'|'denied'|'error'|'empty', message?: string }>}
 */
export async function scanOnce(opt = {}) {
  // 浏览器:直接告诉调用方「没有原生扫码」,由页面保留输入框
  if (!isNative()) return { ok: false, reason: 'not-native' }

  let mod
  try {
    mod = await import('@capacitor-mlkit/barcode-scanning')
  } catch (e) {
    return { ok: false, reason: 'error', message: String((e && e.message) || e) }
  }
  const { BarcodeScanner } = mod

  try {
    // 先确认设备支持(没有相机/被策略禁用时给明确提示,而不是静默失败)
    const { supported } = await BarcodeScanner.isSupported()
    if (!supported) return { ok: false, reason: 'error', message: '本设备不支持扫码' }

    // 相机权限:未授予则申请
    let perm = await BarcodeScanner.checkPermissions()
    if (perm.camera !== 'granted' && perm.camera !== 'limited') {
      perm = await BarcodeScanner.requestPermissions()
    }
    if (perm.camera !== 'granted' && perm.camera !== 'limited') {
      return { ok: false, reason: 'denied', message: '未授予相机权限' }
    }

    // 只扫指定码制,扫完即关(scan() 一次一码,不会持续占用相机)
    const formats = (opt.formats || ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13'])
    const result = await BarcodeScanner.scan({ formats })
    const raw = result && (result.barcodes || [])[0]
    const text = raw && raw.rawValue ? String(raw.rawValue).trim() : ''
    if (!text) return { ok: false, reason: 'empty' }
    return { ok: true, text }
  } catch (e) {
    const msg = String((e && e.message) || e)
    // 用户按返回/取消时插件抛 "scan canceled"
    if (/cancel/i.test(msg)) return { ok: false, reason: 'cancelled' }
    return { ok: false, reason: 'error', message: msg }
  }
}

/** 本机是否具备原生扫码能力(App 内) */
export function hasNativeScan() {
  return isNative()
}
