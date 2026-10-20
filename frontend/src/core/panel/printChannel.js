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
 * @returns {boolean} true=已交给浏览器打印;false=异常(调用方自行提示)
 */
export function printInPage(title, bodyHtml) {
  const prevTitle = document.title
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
    // 等一帧让样式/图片(data URL)生效再拉起打印(否则偶发空白页)
    requestAnimationFrame(() => {
      try { window.print() } catch { cleanup() }
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
