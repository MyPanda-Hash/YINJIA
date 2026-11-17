/**
 * extraRecFile.js —— 「特殊数据记录表」的纯口径（2026-11-17）
 *
 * 用户口径：「在数据记录表列下边…新设计一个面板，可以上传一些比较特殊的数据记录表进行保存，
 *   也可以点击预览这些文件，删除需要管理员审批…所有人只要能看这个面板就可以查看这些上传的数据记录表」。
 * 追问确认：全员可传 / 删除走**单独的「待审批删除」列表**。
 *
 * 本模块只做**判定与格式化**（表格行状态、文件大小、能否预览），不发请求、不碰 Vue，便于单测。
 */

/** 删除审批状态（与后端 rd_extra_rec_file.del_state 同名字面量） */
export const DEL_STATE = { normal: '', pending: 'PENDING' }

/**
 * 一行文件的展示状态：正常 / 待审批删除。
 * @returns {'normal'|'pending'}
 */
export function delStateOf(row) {
  return String(row && row.delState || '').trim().toUpperCase() === DEL_STATE.pending ? 'pending' : 'normal'
}

/** 状态文案（走 tt() 前的中文键） */
export function delStateLabel(row) {
  return delStateOf(row) === 'pending' ? '待审批删除' : '正常'
}

/** 字节数 → 人类可读（1024 进制；无值给 —） */
export function formatSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1024) return n + ' B'
  const kb = n / 1024
  if (kb < 1024) return (Math.round(kb * 10) / 10) + ' KB'
  const mb = kb / 1024
  return (Math.round(mb * 10) / 10) + ' MB'
}

/**
 * 这份文件能不能**浏览器内直接看**（inline）。
 *
 * 口径与后端 AttachmentController.download 的 inline 判定**同一套**
 * （image/* · text/* · application/pdf）——包括老 .doc 走的是 /preview-doc 那条单独通道，
 * 前端这里只决定「点预览是打开浮层看还是提示下载」。
 */
export function canPreviewInline(contentType, fileName) {
  const ct = String(contentType || '').toLowerCase()
  if (ct.startsWith('image/') || ct.startsWith('text/') || ct === 'application/pdf') return true
  // 后端没识别出 contentType 时按扩展名兜底（现场文件常带中文名、type 为空）
  const ext = String(fileName || '').toLowerCase().match(/\.[a-z0-9]+$/);
  const e = ext ? ext[0] : ''
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.pdf', '.txt', '.log', '.csv', '.md'].includes(e)
}

/**
 * 删除按钮的形态：
 *   · 正常 → 「删除」（提交删除申请）
 *   · 待审批 + 我申请的或我是审批人 → 「撤回」
 *   · 待审批 + 别人申请 + 我没审批权 → 置灰不可点（提示等待审批）
 *
 * @returns {{action:'request'|'cancel'|'wait', disabled:boolean}}
 */
export function deleteActionOf(row, { canApprove = false, user = '' } = {}) {
  if (delStateOf(row) !== 'pending') return { action: 'request', disabled: false }
  const reqBy = String(row && row.delReqBy || '').trim()
  const mine = !!reqBy && !!String(user || '').trim() && reqBy === String(user).trim()
  if (canApprove || mine) return { action: 'cancel', disabled: false }
  return { action: 'wait', disabled: true }
}

