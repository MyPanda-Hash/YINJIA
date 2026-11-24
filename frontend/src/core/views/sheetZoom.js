/**
 * 纸面缩放口径（2026-11-24）。
 *
 * 背景：DocSheet 系文书纸面（立项申请/项目实施计划等）纸宽**定死**（RD_APPROVAL 1242px），
 * 窗口装不下时按「可用宽 ÷ 纸宽」整体缩小（下限 0.6），上限 1（宽屏不放大，保持设计字号）。
 * 副作用：窗口窄的用户纸面被缩到 ~0.7，字跟着变小；而且**没有手动放大入口** ⇒
 * 用户报「面板看起来有点小，其他人都没有就他有，也调不大」。
 *
 * 处置（2026-11-24 用户选定的方案）：保留「适应宽度」为默认，另加手动缩放
 * （缩小/放大，10% 一档，最大 150%），并按面板记住选择。
 *
 * 这里只放**纯函数**（不碰 DOM），DOM 侧在 DocSheet（算样式）与 PanelxList（渲染缩放条）。
 * 打印不受影响：截图导出路径已强制 `clone.style.zoom = '1'`（见 PanelxList.openSheetPrint 注释），
 * 原生打印另由 `--print-zoom` / `body.approval-printing` 规则接管。
 */

/** 自动适应宽度的下限：再小就看不清了，剩余交给横向滚动 */
export const MIN_SHEET_ZOOM = 0.6
/** 手动放大的上限（用户口径：最大 150%） */
export const MAX_SHEET_ZOOM = 1.5
/** 每次点击的步进 */
export const ZOOM_STEP = 0.1
/** 纸面两侧留白：免得滚动条/边框把纸挤掉 1px 又触发横向滚动 */
const SIDE_PADDING = 16

const round2 = (n) => Math.round(n * 100) / 100

/**
 * 适应宽度：可用宽 ÷ 纸宽，封顶 1、封底 {@link MIN_SHEET_ZOOM}。
 * @param {number} availWidth 纸面父容器内宽（0 = 还没量到）
 * @param {number} paperWidth 纸面设计宽（0/undefined = 该面板不定宽，不缩放）
 * @returns {number} 1 表示不缩放
 */
export function fitZoom(availWidth, paperWidth) {
  const paper = Number(paperWidth) || 0
  if (paper <= 0) return 1
  const avail = Number(availWidth) || 0
  if (avail <= 0) return 1
  const usable = avail - SIDE_PADDING
  return Math.min(1, Math.max(MIN_SHEET_ZOOM, usable / paper))
}

/**
 * 手动值钳位：[MIN, MAX]，保留两位小数；非法值（含空串/NaN/非数字）返回 null「没设置」。
 * @param {number|string|null|undefined} value
 * @returns {number|null}
 */
export function clampZoom(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return round2(Math.min(MAX_SHEET_ZOOM, Math.max(MIN_SHEET_ZOOM, n)))
}

/**
 * 步进一档。`current` 为 null（当前是适应宽度）时返回 null —— 不给一个「凭空起步」，由调用方先取 fit。
 * @param {number|null} current
 * @param {number} dir +1 放大 / -1 缩小
 * @returns {number|null}
 */
export function stepZoom(current, dir) {
  const cur = clampZoom(current)
  if (cur === null) return null
  return clampZoom(cur + (dir >= 0 ? ZOOM_STEP : -ZOOM_STEP))
}

/**
 * 实际生效的缩放：手动值优先（可超过 1，最多 1.5），否则用适应宽度。
 * @param {number|string|null} userZoom
 * @param {number} fit 适应宽度算出的值
 * @returns {number}
 */
export function resolveZoom(userZoom, fit) {
  const manual = clampZoom(userZoom)
  if (manual !== null) return manual
  return fit
}

/** localStorage 键：按面板分开记（立项申请调大不影响项目实施计划） */
export function zoomStoreKey(panelCode) {
  return 'mes_sheet_zoom_' + String(panelCode || '')
}

/**
 * 读回该面板记住的手动缩放；没存过/坏数据/storage 不可用一律 null（= 适应宽度）。
 * @param {string} panelCode
 * @param {Storage|{getItem:Function}} [storage]
 */
export function loadStoredZoom(panelCode, storage) {
  const store = storage || safeStorage()
  if (!store) return null
  try {
    return clampZoom(store.getItem(zoomStoreKey(panelCode)))
  } catch {
    return null
  }
}

/**
 * 记住该面板的手动缩放；storage 不可用或超范围时返回 null（调用方按「没记住」处理）。
 * @param {string} panelCode
 * @param {number} value
 * @param {Storage|{getItem:Function}} [storage]
 */
export function saveStoredZoom(panelCode, value, storage) {
  const v = clampZoom(value)
  const store = storage || safeStorage()
  if (v === null || !store) return null
  try {
    store.setItem(zoomStoreKey(panelCode), String(v))
    return v
  } catch {
    return null
  }
}

/** 清掉该面板的手动缩放（点「适应宽度」时调用） */
export function clearStoredZoom(panelCode, storage) {
  const store = storage || safeStorage()
  if (!store) return false
  try {
    store.removeItem(zoomStoreKey(panelCode))
    return true
  } catch {
    return false
  }
}

/** 隐私模式/禁用 storage 时访问 localStorage 本身就会抛，统一兜住 */
function safeStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
