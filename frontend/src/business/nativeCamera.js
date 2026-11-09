/**
 * nativeCamera.js — 安卓壳(APK)里的「原生拍照」桥(2026-11-09 第四轮)
 *
 * 【用户口径】「点击拍照上传附件,并没有调用摄像机,摄像机就同一沿用之前的就行。」
 *
 * 【为什么必须原生】APK 里页面跑在 `file:///android_asset/www/index.html`,WebView 对
 * `<input type=file capture>` 不会拉起相机(壳没实现 onShowFileChooser 时连文件框都没反应),
 * 所以「拍照」只能在原生层做 —— 复用扫码页那台相机(`ScanActivity` 的 photo 模式,同一套预览/对焦/手电),
 * 拍完把 JPEG 压到长边 ≤1280 存缓存,再由 `MainActivity` 读成 dataURL 回抛给网页。
 *
 * 【桥契约】(与 android/app/src/.../MainActivity.java 的 Bridge 逐字对齐)
 *   网页 → 原生:`window.YjNative.takePhoto()`          打开拍照页
 *   原生 → 网页:`window.__yjPhotoResult(dataUrl, fileName, errText)`
 *     · 用户取消:dataUrl='' 且 errText='' ⇒ 本模块 resolve(null),调用方当"没选"处理;
 *     · 失败:errText 非空 ⇒ reject;
 *     · 成功:dataUrl=`data:image/jpeg;base64,…` ⇒ 本模块转成 **File**,调用方照常走 /attachment/upload。
 *
 * 【浏览器里会自动退化】`hasNativeCamera()` 为 false(网页版/5173/桌面浏览器),
 * 调用方继续用 `<input type=file accept="image/*" capture>` —— 手机浏览器照样能调相机。
 */

/** 当前是不是在 APK 壳里(壳注入了 YjNative.takePhoto) */
export function hasNativeCamera() {
  try {
    return typeof window !== 'undefined'
      && !!window.YjNative
      && typeof window.YjNative.takePhoto === 'function'
  } catch (e) {
    return false
  }
}

/**
 * 解析 dataURL(纯函数,可单测)。
 * @param {string} dataUrl 形如 `data:image/jpeg;base64,xxxx`
 * @returns {{mime:string, base64:boolean, data:string}|null} 不是 dataURL 返回 null
 */
export function parseDataUrl(dataUrl) {
  const s = String(dataUrl ?? '')
  const m = s.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/)
  if (!m) return null
  return { mime: m[1] || 'application/octet-stream', base64: !!m[2], data: m[3] }
}

/** base64 → Uint8Array(逐字节,不用 atob 的 latin1 字符串直接当字节) */
function base64ToBytes(b64) {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * dataURL → File(上传接口要 File 对象)。base64 之外的形式不支持(原生只会回 base64)。
 * @param {string} dataUrl
 * @param {string} [name]
 * @returns {File}
 */
export function dataUrlToFile(dataUrl, name = 'photo.jpg') {
  const p = parseDataUrl(dataUrl)
  if (!p || !p.base64 || !p.data) throw new Error('照片数据无效')
  const bytes = base64ToBytes(p.data)
  const fname = String(name || 'photo.jpg')
  if (typeof File === 'function') return new File([bytes], fname, { type: p.mime })
  // 极老环境兜底:Blob 挂上 name(上传只用到 blob + name)
  const blob = new Blob([bytes], { type: p.mime })
  blob.name = fname
  return blob
}

/**
 * 打开原生相机拍一张,拿到 File;用户取消返回 null。
 *
 * @param {{timeoutMs?: number}} [opts] 默认 2 分钟(现场拍完再点确定,别太短)
 * @returns {Promise<File|null>}
 */
export function takeNativePhoto(opts = {}) {
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 120000
  if (!hasNativeCamera()) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    let done = false
    let timer = 0
    const finish = (val, errMsg) => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      try { window.__yjPhotoResult = null } catch (e) { /* ignore */ }
      if (errMsg) reject(new Error(String(errMsg)))
      else resolve(val)
    }
    timer = setTimeout(() => finish(null), timeoutMs)
    window.__yjPhotoResult = (dataUrl, fileName, errText) => {
      if (errText) { finish(null, errText); return }
      if (!dataUrl) { finish(null); return }   // 用户取消
      try {
        finish(dataUrlToFile(dataUrl, fileName || 'photo.jpg'))
      } catch (e) {
        finish(null, e?.message || '照片数据无效')
      }
    }
    try {
      window.YjNative.takePhoto()
    } catch (e) {
      finish(null, e?.message || '打不开相机')
    }
  })
}
