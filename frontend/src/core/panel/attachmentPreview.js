/**
 * attachmentPreview.js —— 附件「点开就看」的统一预览入口(2026-10-28)
 *
 * 【口径来源】用户原话:
 *   「上传的附件在单据未保存的时候,点击也可以查看,现在是只能是下载下来再查看,
 *    看看能不能加上预览的功能就不需要每次都下载再看,归档的也是一样」
 *
 * 【为什么单独抽出来】预览能力原先散在 ShareFileCenter.vue 的页面私有函数里
 *   (renderDocxToWindow / isDocx / triggerDownload),单据附件格 FileAttachCell 只能
 *   image/·text/·application/pdf 走 inline,其余一律 a.download —— 所以 Word/Excel 附件
 *   每次都要先下载。这里把「判定能不能预览 + 怎么预览 + 不能预览怎么降级」收成一份:
 *     · ShareFileCenter(分享文件库)与 FileAttachCell(单据附件)共用同一套行为;
 *     · 以后再加 xlsx/pptx 预览只改这一处。
 *
 * 【预览矩阵】
 *   image/*、text/*、application/json          → blob 直开(浏览器原生渲染)
 *   application/pdf                             → blob 直开(浏览器 PDF 阅读器)
 *   .docx(wordprocessingml)                     → docx-preview 渲染成 HTML 写入占位窗口
 *   .xlsx / .xls / .csv                         → SheetJS 读表 → 简易 HTML 表格写入占位窗口
 *   其余(.doc 老格式、压缩包、dwg…)              → 降级为下载(浏览器无原生渲染能力)
 *
 * ⚠ 预览与「单据能不能编辑」无关:只读/审批中/已归档的单据同样可点开 ——
 *   能不能看只由后端 requirePanelView(该面板查看权)决定,见 FileAttachCell 头注释。
 * ⚠ 占位窗口必须**同步**开(在用户点击手势内),否则 await 之后会被浏览器当弹窗拦截。
 */

/** 扩展名(小写,不含点);取不到返回空串 */
export function extOf(fileName) {
  const s = String(fileName || '')
  const i = s.lastIndexOf('.')
  return i >= 0 ? s.slice(i + 1).toLowerCase() : ''
}

/** docx 判定:contentType 优先(wordprocessingml),扩展名兜底(历史行 content_type 可能缺失/不准) */
export function isDocxLike(file) {
  const type = String(file?.contentType || '')
  if (type.includes('wordprocessingml')) return true
  return extOf(file?.fileName || file?.name) === 'docx'
}

/**
 * 老二进制 Word(.doc/OLE2)判定 —— 与 docx 分开,因为它走**后端转换**而不是前端渲染。
 * 实测现场文件「开题报告-修改版.doc」头 4 字节 D0 CF 11 E0 = OLE2,docx-preview 必然失败。
 * ⚠ 注意 contentType 可能是 application/msword,也可能是别的(历史数据),扩展名要一起认。
 */
export function isLegacyDoc(file) {
  const type = String(file?.contentType || '')
  if (type === 'application/msword') return true
  return extOf(file?.fileName || file?.name) === 'doc'
}

/** 表格判定:SheetJS 能吃 xlsx/xls/csv */
export function isSheetLike(file) {
  const type = String(file?.contentType || '')
  if (type.includes('spreadsheetml') || type === 'application/vnd.ms-excel') return true
  return ['xlsx', 'xls', 'csv'].includes(extOf(file?.fileName || file?.name))
}

/** 浏览器原生能直接渲染的类型(直接 blob URL 打开) */
export function isNativeInline(file) {
  const type = String(file?.contentType || '')
  return type.startsWith('image/') || type.startsWith('text/')
    || type === 'application/pdf' || type === 'application/json'
}

/**
 * 能不能在线预览。
 * @param {{contentType?:string, fileName?:string, name?:string}} file
 * @returns {boolean}
 */
export function canPreview(file) {
  return isNativeInline(file) || isDocxLike(file) || isLegacyDoc(file) || isSheetLike(file)
}

/** 触发下载(不可预览类型的保底;也用于预览失败降级) */
export function triggerDownload(url, name) {
  const el = document.createElement('a')
  el.href = url
  el.download = name || 'attachment'
  el.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** 一个最小的占位窗口骨架(顺序:先开空窗,再由调用方写内容) */
function writeWindow(win, title, styleText, bodyHtml) {
  if (!win) return false
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  win.document.open()
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>'
    + '<style>body{margin:0;background:#525659;padding:16px;font:13px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;}'
    + 'table{border-collapse:collapse;background:#fff;margin:0 auto 16px;}'
    + 'td,th{border:1px solid #d0d3d9;padding:4px 8px;font-size:12px;white-space:nowrap;}'
    + 'th{background:#eef2f7;font-weight:600;}</style>'
    + (styleText || '')
    + '</head><body>' + bodyHtml + '</body></html>'
  )
  win.document.close()
  return true
}

/**
 * docx → HTML 渲染进占位窗口。
 * docx-preview 按需动态加载(不预览 Word 就不下载这段代码);先在主文档隐藏容器渲染再序列化,
 * 避免第三方库跨 window 建 DOM 的兼容性问题;useBase64URL 让内嵌图片变 data URI,窗口自包含。
 */
async function renderDocxToWindow(blob, file, win) {
  const { renderAsync } = await import('docx-preview')
  const buf = await blob.arrayBuffer()
  const bodyHost = document.createElement('div')
  const styleHost = document.createElement('div')
  bodyHost.style.display = 'none'
  styleHost.style.display = 'none'
  document.body.appendChild(bodyHost)
  document.body.appendChild(styleHost)
  try {
    await renderAsync(buf, bodyHost, styleHost, { inWrapper: true, useBase64URL: true })
    if (!bodyHost.innerHTML) throw new Error('docx 渲染结果为空')
    writeWindow(win, file?.fileName || file?.name || '', styleHost.innerHTML, bodyHost.innerHTML)
  } finally {
    bodyHost.remove()
    styleHost.remove()
  }
}

/** 表格 → 简易 HTML(每个工作表一块,最多 3 个 sheet / 每个 300 行,避免超大表格卡死窗口) */
async function renderSheetToWindow(blob, file, win) {
  const XLSX = await import('xlsx')
  const buf = await blob.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const parts = []
  for (const name of wb.SheetNames.slice(0, 3)) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' }).slice(0, 300)
    const body = rows.map((r, i) => {
      const tag = i === 0 ? 'th' : 'td'
      return '<tr>' + r.map((c) => '<' + tag + '>' + esc(c) + '</' + tag + '>').join('') + '</tr>'
    }).join('')
    parts.push('<h3 style="color:#e8eef6;text-align:center;font-weight:500">' + esc(name) + '</h3><table>' + body + '</table>')
  }
  if (!parts.length) throw new Error('工作簿为空')
  writeWindow(win, file?.fileName || file?.name || '', '', parts.join(''))
}

/**
 * 统一预览入口:同步开占位窗 → 拉 blob → 按类型渲染;失败自动降级为下载。
 *
 * @param {object} file  附件行(需 id / fileName / contentType)
 * @param {object} opts
 * @param {(url:string)=>Promise<Blob>} opts.loadBlob  取文件字节(由调用方决定用哪个接口鉴权)
 * @param {(msg:string)=>void} [opts.onInfo]           提示回调(如「该文件无法在线预览,已转为下载」)
 * @param {(msg:string)=>void} [opts.onError]          错误回调
 * @returns {Promise<'preview'|'download'|'failed'>}
 */
export async function openAttachmentPreview(file, opts = {}) {
  const { loadBlob, loadLegacyDocHtml, onInfo = () => {}, onError = () => {} } = opts
  const name = file?.fileName || file?.name || ''
  if (!canPreview(file)) {
    // 不可预览:直接下载(老的 .doc/.xls、压缩包、图纸等)
    try {
      const blob = await loadBlob()
      triggerDownload(URL.createObjectURL(blob), name)
      onInfo('已开始下载')
      return 'download'
    } catch {
      onError('附件下载失败')
      return 'failed'
    }
  }
  // 必须在用户手势内同步开窗,否则 await 之后被弹窗拦截
  const win = window.open('', '_blank')
  try {
    if (isLegacyDoc(file)) {
      // 老 .doc(OLE2):前端无解析能力 ⇒ 后端 HWPF 转 HTML,再写进占位窗。
      // 失败(加密/损坏/超限)降级下载,不让用户卡在空白窗。
      if (!win) {
        // 弹窗被拦截:与 docx 分支同口径 —— 直接下载,别让用户点了没反应
        try {
          const blob = await loadBlob()
          triggerDownload(URL.createObjectURL(blob), name)
          onInfo('浏览器拦截了新窗口，请允许弹出窗口(已转为下载)')
          return 'download'
        } catch {
          onError('附件下载失败')
          return 'failed'
        }
      }
      try {
        const html = await opts.loadLegacyDocHtml(file)
        win.document.open()
        win.document.write(html)
        win.document.close()
        return 'preview'
      } catch {
        win.close()
        const blob = await loadBlob()
        triggerDownload(URL.createObjectURL(blob), name)
        onInfo('该文件无法在线预览，已转为下载')
        return 'download'
      }
    }
    const blob = await loadBlob()
    if (isDocxLike(file)) {
      if (!win) {
        triggerDownload(URL.createObjectURL(blob), name)
        onInfo('浏览器拦截了新窗口，请允许弹出窗口')
        return 'download'
      }
      try {
        await renderDocxToWindow(blob, file, win)
        return 'preview'
      } catch {
        win.close()
        triggerDownload(URL.createObjectURL(blob), name)
        onInfo('该文件无法在线预览，已转为下载')
        return 'download'
      }
    }
    if (isSheetLike(file)) {
      if (!win) {
        triggerDownload(URL.createObjectURL(blob), name)
        onInfo('浏览器拦截了新窗口，请允许弹出窗口')
        return 'download'
      }
      try {
        await renderSheetToWindow(blob, file, win)
        return 'preview'
      } catch {
        win.close()
        triggerDownload(URL.createObjectURL(blob), name)
        onInfo('该文件无法在线预览，已转为下载')
        return 'download'
      }
    }
    // 原生可渲染类型
    const url = URL.createObjectURL(blob)
    if (win) win.location.href = url
    else {
      triggerDownload(url, name)
      onInfo('浏览器拦截了新窗口，请允许弹出窗口')
      return 'download'
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000)
    return 'preview'
  } catch {
    if (win) win.close()
    onError('附件下载失败')
    return 'failed'
  }
}
