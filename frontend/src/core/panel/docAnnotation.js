/**
 * docAnnotation.js —— 「标注笔 / 橡皮擦」的纯逻辑(无 DOM、可 node --test)
 *
 * 【为什么单独抽出来】
 * 标注的本质是「把一段文本按若干 (start,end,color,bold) 区间切成带样式的段」。
 * 这里全是边界算术:取反区间、越界、重叠、相邻、空段……算错不会抛错,只会"显示少一格"
 * 或"打印颜色丢了",靠肉眼看纸面几乎发现不了 ⇒ 收敛成纯函数 + 单测。
 *
 * 【坐标口径(全链路统一)】
 *   start/end = 相对**该字段的完整原文**的字符下标,0 基,**左闭右开 [start,end)**;
 *   多段可共存;重叠时**后写入的段覆盖先写入的**(保存时后端已归一,渲染再兜一层)。
 */

/** 色盘(8 档;选的是打印可读的深色,浅黄只适合少量强调) */
export const ANNOTATION_COLORS = [
  '#d0021b', // 红
  '#f5a623', // 橙
  '#b8860b', // 金
  '#417505', // 绿
  '#116a5b', // 墨绿(与系统主色同族)
  '#4a6fa5', // 蓝
  '#9013fe', // 紫
  '#4a4a4a', // 深灰
]

/** 一条标注是否形状合法(不判范围是否越界,越界由 normalize 处理) */
export function isValidAnnotation(a) {
  return !!a && Number.isInteger(a.start) && Number.isInteger(a.end) && a.end > a.start && !!a.color
}

/**
 * 归一:裁到 [0,len] → 丢掉空段/越界段 → 按 start 排序 → 同位置短段优先(内层压外层)
 * @returns [{start,end,color,bold}] 升序、两两不重叠
 */
export function normalize(text, anns) {
  const len = String(text ?? '').length
  const out = []
  for (const a of anns || []) {
    if (!a || !Number.isFinite(a.start) || !Number.isFinite(a.end) || !a.color) continue
    const s = Math.max(0, Math.min(len, Math.trunc(a.start)))
    const e = Math.max(0, Math.min(len, Math.trunc(a.end)))
    if (e <= s) continue                        // 空段/反段一律丢(换序是 makeAnnotation 的职责)
    const o = { start: s, end: e, color: a.color }
    if (a.bold) o.bold = true                   // 默认省略,bold 为真才写
    out.push(o)
  }
  // 按 start 升序(稳定排序:同 start 保持写入先后 ⇒ 后写入的段在下面覆盖先写入的)
  return out.sort((x, y) => x.start - y.start)
}

/**
 * 把原文切成带样式的段:未标注的段 color=null/bold=false
 * 重叠处理:按 normalize 的先后**逐字符覆盖**(后段压前段),保证拼回来逐字等于原文。
 * @returns [{ text, color, bold }] 顺序拼接后必须等于原文
 */
export function segments(text, anns) {
  const t = String(text ?? '')
  if (!t) return []
  const list = normalize(t, anns)
  if (!list.length) return [{ text: t, color: null, bold: false }]

  // 每个字符落在哪个段上(后段覆盖前段)
  const style = new Array(t.length).fill(null)
  for (const a of list) for (let i = a.start; i < a.end; i++) style[i] = a

  const out = []
  let runColor = null
  let runBold = false
  let buf = ''
  for (let i = 0; i < t.length; i++) {
    const s = style[i]
    const c = s ? s.color : null
    const b = s ? !!s.bold : false
    if (buf && (c !== runColor || b !== runBold)) {
      out.push({ text: buf, color: runColor, bold: runBold })
      buf = ''
    }
    if (!buf) { runColor = c; runBold = b }
    buf += t[i]
  }
  if (buf) out.push({ text: buf, color: runColor, bold: runBold })
  return out
}

/** 橡皮擦命中测试:pos 落在哪一段内(重叠时取最内层/最后一段);未命中 -1 */
export function hitIndex(anns, pos) {
  const list = anns || []
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i]
    if (pos >= a.start && pos < a.end) return i
  }
  return -1
}

/** 造一条新标注:范围取整、自动换序、空区间拒绝 */
export function makeAnnotation(text, start, end, color, bold) {
  const len = String(text ?? '').length
  let s = Number(start)
  let e = Number(end)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { ok: false, reason: '无效范围' }
  s = Math.max(0, Math.min(len, Math.trunc(s)))
  e = Math.max(0, Math.min(len, Math.trunc(e)))
  if (s > e) { const tmp = s; s = e; e = tmp }
  if (e - s <= 0) return { ok: false, reason: '空范围' }
  if (!color) return { ok: false, reason: '未选颜色' }
  return { ok: true, ann: { start: s, end: e, color, bold: !!bold } }
}

/** 从 DOM 选区算 [start,end):选区两端必须落在**同一个**文本节点内,否则返回 null */
export function rangeInTextNode(sel) {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const r = sel.getRangeAt(0)
  const a = r.startContainer
  const b = r.endContainer
  if (!a || a !== b || a.nodeType !== 3) return null
  return { node: a, start: r.startOffset, end: r.endOffset }
}
