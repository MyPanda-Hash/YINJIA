/**
 * printChannel.js — 页面内打印通道(2026-10-20 统一)
 *
 * **全系统只留这一条出纸通道**:把待打印的 HTML 挂到 body 末尾一个隐藏层里,
 * 打印时用 `@media print` 把其它内容全部隐藏,再 `window.print()`;打完(`afterprint`)整层摘掉。
 *
 * 为什么不再弹窗(2026-10-18 现场「打印后整页卡死,刷新也无效,只能关标签」):
 *   ① 同源弹窗与主页面**共用一个渲染进程**——打印预览/虚拟打印机(WPS 虚拟 PDF)一卡,
 *      主页面跟着僵死;刷新还是同一个进程 ⇒ 救不回来。
 *   ② 每次打印再新开一个带整页二维码图片的窗口,窗口/内存堆积(先改成复用+自动关,但那只是缓解)。
 *   而**面板单据打印**走的是"主页面打印层 + window.print()",现场天天打、从来没卡过
 *   ⇒ 把全部纸质单据/标签都切到同一条路:
 *     · 打印工单(生产任务单)                 2026-10-19
 *     · 商品/仓位/采购入库单标识卡、采购订单、退货单、采购订单打印材料码、二维码标签  2026-10-20
 *
 * 用法:`printInPage(title, '<style>…</style><div>…</div>')`;返回 false = 浏览器拒了(调用方提示)。
 * ⚠ 内容里的 `<style>` 会作用于**整个文档**,类名请用专属名(如 `.card`/`.lb` 这类通用名
 *   要先确认全局没有同名样式),或直接用 `#yj-print-host` 前缀收窄——本工程全局 CSS 里
 *   `.card/.f/.lb/.v/.qr` 等只在 scoped 样式里出现(`src/styles/index.css` 无这些类),故可直接用。
 */
export const PRINT_HOST_ID = 'yj-print-host'
const PRINT_CSS_ID = 'yj-print-host-css'
/** 兜底清理:某些浏览器不触发 afterprint(定时器挂 3 分钟后自己摘层;打印对话框停得久也不至于被提前摘掉) */
const PRINT_GUARD_MS = 180000

/** 上一次打印的清理句柄:连点两次按钮 / 上一次 afterprint 没来(浏览器直接关页)时先收拾干净 */
let pendingCleanup = null

/**
 * 在**当前页面**打印一段独立 HTML(不弹窗、不 document.write、不在子窗口里 print)。
 * @param {string} title 打印期间的 document.title(打印页眉/另存 PDF 的默认文件名)
 * @param {string} bodyHtml 待打印内容(可带 <style>);建议自带 `@page{size:…}` 控制纸张
 * @param {Object} [opts] 可选项
 * @param {Function} [opts.onDone] **打印结束**(afterprint / 兜底清理)后回调一次。
 *   用途:调用方原来在 `window.print()` 之后**紧接着**刷新数据/重绘 —— 而打印对话框打开期间
 *   渲染进程被浏览器占着,这时再发请求 + 重绘,界面看起来就是"卡死"(2026-10-29 供应商现场)。
 *   把刷新放到这个回调里,打印层摘掉之后再动 DOM。
 * @returns {boolean} true=已交给浏览器打印;false=异常(调用方自行提示)
 */
export function printInPage(title, bodyHtml, opts) {
  const prevTitle = document.title
  const onDone = typeof opts?.onDone === 'function' ? opts.onDone : null
  let timer = null
  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    if (timer) clearTimeout(timer)
    try { document.getElementById(PRINT_HOST_ID)?.remove() } catch { /* 页面切换中忽略 */ }
    try { document.getElementById(PRINT_CSS_ID)?.remove() } catch { /* 同上 */ }
    if (title) document.title = prevTitle
    window.removeEventListener?.('afterprint', cleanup)
    if (pendingCleanup === cleanup) pendingCleanup = null
    // 兜底清理(3 分钟)不是"真的打完了"——只有 afterprint 才算;但两种都回调,免得调用方永远等不到
    if (onDone) { try { onDone() } catch (e) { console.warn('[printChannel] onDone 回调失败:', e?.message || e) } }
  }
  try {
    if (pendingCleanup) pendingCleanup() // 上一次没走完(打印中途关掉/浏览器不触发 afterprint)
    const host = document.createElement('div')
    host.id = PRINT_HOST_ID
    host.innerHTML = bodyHtml
    document.body.appendChild(host)
    const style = document.createElement('style')
    style.id = PRINT_CSS_ID
    // 屏幕上完全看不到这一层;打印时只留它,并把 html/body 的高度/溢出复位
    // (`html,body{height:100%}` 是应用外壳的全局样式,多页打印会被它裁掉后面的页)
    style.textContent = '@media screen{#yj-print-host{display:none!important}}'
      + '@media print{body>*:not(#yj-print-host){display:none!important}'
      + 'html,body{height:auto!important;min-height:0!important;overflow:visible!important;'
      + 'background:#fff!important;margin:0!important;padding:0!important}'
      + '#yj-print-host{display:block!important;height:auto!important;overflow:visible!important}}'
    document.head.appendChild(style)
    window.addEventListener?.('afterprint', cleanup)
    pendingCleanup = cleanup
    if (title) document.title = title
    // 等一帧让样式生效,再**等图片解码完**才拉起打印(2026-10-29 用户报障「打印会出现 Edge 无响应」)。
    //
    // 为什么不能只等一帧:材料码卡面里有二维码(data URL 图片)。一帧时它们往往还没解码,
    // 于是浏览器的**打印预览/光栅化要做在 window.print() 内部**(同步、冻结渲染进程)——
    // 界面就整个"未响应",打印机对话框关掉后才恢复,现场感受就是"卡很久"。
    // 先把图片解码好再 print,布局与光栅化都在主线程之外完成,对话框一弹立刻能响应。
    const imagesReady = (imgList) => {
      const imgs = imgList || []
      if (!imgs.length) return Promise.resolve()
      const one = (img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
        // decode() 是标准 API(Chrome/Edge 90+);老浏览器没有就退回 load 事件
        if (typeof img.decode === 'function') return img.decode().catch(() => {})
        return new Promise((res) => {
          img.addEventListener('load', res, { once: true })
          img.addEventListener('error', res, { once: true })
          setTimeout(res, 2000)   // 兜底:图片挂了也别把打印卡住
        })
      }
      return Promise.race([
        Promise.all(imgs.map(one)),
        new Promise((res) => setTimeout(res, 3000)),  // 整体兜底:3 秒还没好就照常打,不能一直等
      ])
    }
    // 先等一帧让样式/布局生效,再决定要不要等图片(否则偶发空白页)。
    //   · 打印层里**没有图片**(纯文字单据):与历史行为完全一致,一帧后直接 print;
    //   · 有图片(材料码/标签里的二维码 data URL):等它们解码完再 print ——
    //     否则打印预览的光栅化会做在 window.print() 内部(同步冻结渲染进程),
    //     现场表现为"打印时 Edge 未响应,要等很久"(2026-10-29 用户报障)。
    requestAnimationFrame(() => {
      // ⚠ 用可选调用:单测桩的 DOM 元素没有 querySelectorAll,别让"等图片"这层把打印整条路弄挂
      const imgs = typeof host.querySelectorAll === 'function'
        ? Array.from(host.querySelectorAll('img'))
        : []
      if (!imgs.length) {
        try { window.print() } catch { cleanup() }
        return
      }
      imagesReady(imgs).finally(() => {
        try { window.print() } catch { cleanup() }
      })
    })
    timer = setTimeout(cleanup, PRINT_GUARD_MS)
    // node --test 里 setTimeout 返回 Timeout 对象:unref 掉,别让单测进程挂着等这 3 分钟
    if (timer && typeof timer.unref === 'function') timer.unref()
    return true
  } catch (e) {
    cleanup()
    console.warn('[printChannel] 页面内打印失败:', e?.message || e)
    return false
  }
}

/** 打印层是否还挂在页面上(留痕/探针用;正常情况下打印结束即摘掉) */
export function isPrintHostMounted() {
  return !!document.getElementById(PRINT_HOST_ID)
}
