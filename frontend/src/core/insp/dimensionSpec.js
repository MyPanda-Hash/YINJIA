/**
 * dimensionSpec.js — 规格书「检验项目=尺寸」那一行的「检验要求」→ 成型工艺清单的四个尺寸格
 * (纯函数,可 node --test 断言)
 *
 * 用户口径(2026-10-15 实测反馈):
 *   「如果是尺寸,应该是把对应检测的**内径或者外径的公差**等数据填写进成型工艺清单的对应检测要求里面的数据表格里面」
 *   即:规格书 `检验项目=尺寸` 的「检验要求」是一整句(实测 SD-2026-10-0004 同款句式来自产品信息表
 *   「整体规格参数」:`外径 20±0.5mm、内径 5±0.3mm、长度 250±2mm`),要**拆成四格**:
 *     外径mm ← 20    外径公差 ← ±0.5
 *     内径mm ← 5     内径公差 ← ±0.3
 *
 * 口径与 carbonSpec.js(同款「按关键词 + 正则抠数字」)一致的三条:
 *   ① 解析不出来的格**一个键都不出现** —— 绝不写半截值(如只有 `外径mm` 没有 `外径公差`)或空串;
 *   ② **长度不解析**:本面板没有「长度」数据格(最短长度mm/中间值mm/最长长度mm 是脱模的长度**范围**三项,
 *      与规格书那个名义长度不是一个语义),硬塞会把范围格填错 ⇒ 宁缺毋滥,整句里的长度项直接忽略;
 *   ③ 公差**原样带符号**(`±0.5` 而不是 `0.5`):该格语义是"偏差",脱掉符号后与"范围半宽"无法区分,
 *      且未来出现非对称公差(`+0.5/-0.1`)时同一格仍然成立。
 *
 * 全角/半角都认:先按 NFKC 之外的显式映射把全角数字/字母/符号折成半角(全角空格折成普通空格),
 * 再匹配 —— 规格书的检验要求是人工填写的,`外径２０±０．５ｍｍ` 与 `外径 20±0.5mm` 必须同解。
 */

/** 全角 → 半角(U+FF01..U+FF5E 整体平移 0xFEE0;全角空格单独折成普通空格) */
function toHalfWidth(s) {
  return String(s ?? '')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
}

/** 名义尺寸 + 可选公差:`外径 20±0.5mm` / `内径:5 +-0.3 mm` */
const TOL = '(±|\\+/-|\\+-)\\s*([0-9]+(?:\\.[0-9]+)?)'

/**
 * @param {string|null|undefined} text 规格书里「检验项目=尺寸」那一行的 检验要求(整句)
 * @returns {Record<string,string>} **只含解析成功的格**:
 *   { 外径mm?: '20', 外径公差?: '±0.5', 内径mm?: '5', 内径公差?: '±0.3' }
 */
export function parseDimensionRequirement(text) {
  const out = {}
  const s = toHalfWidth(text)
  if (!s.trim()) return out
  for (const d of [
    { kw: '外径', mm: '外径mm', tol: '外径公差' },
    { kw: '内径', mm: '内径mm', tol: '内径公差' },
  ]) {
    // 关键词后先给冒号/空白留位,再抠"名义值 [+ 公差]"
    const m = s.match(new RegExp(d.kw + '\\s*[:：]?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(?:' + TOL + ')?'))
    if (!m) continue
    // 只有"关键词后面跟着数字"才算命中:`外径 ±0.5mm` 这种没有名义值的句子一格都不写
    out[d.mm] = m[1]
    if (m[2] && m[3]) out[d.tol] = m[2] + m[3]
  }
  return out
}

/**
 * 同一句「炭棒尺寸」，但落到 **X烧结工艺清单**(RD_X_SINTER) 的三格。  2026-10-30
 *
 * 与 {@link parseDimensionRequirement} 的三处刻意差异（不要混用）：
 *   ① **输出键是 X烧结的字段名**：炭棒外径 / 炭棒内径 / 炭棒出货长度
 *      —— 成型工艺清单那边是 外径mm/内径mm；两面板格名不同，键写错会静默不生效；
 *   ② **要长度**：成型工艺清单没有"名义长度"格（它那三段是脱模的长度**范围**），
 *      而 X烧结的「炭棒出货长度」是计算的必要输入（切割长度 = 出货长度 + 修正参数），非带不可；
 *   ③ **不要公差**：X烧结的 炭棒外径公差/内径公差 由**模具表**带入，不是规格书。
 *
 * 解析不出来的格**一个键都不出现**（与上面同一条口径：绝不写半截值）。
 *
 * @param {string|null|undefined} text 规格书「检验项目=尺寸/炭棒尺寸」那行的检验要求整句
 * @returns {Record<string,string>} 形如 { 炭棒外径:'30', 炭棒内径:'12', 炭棒出货长度:'116' }
 */
export function parseRodSizeRequirement(text) {
  const out = {}
  const s = toHalfWidth(text)
  if (!s.trim()) return out
  const DIM = '([0-9]+(?:\\.[0-9]+)?)'
  const outer = s.match(new RegExp('外径\\s*[:：]?\\s*' + DIM))
  if (outer) out['炭棒外径'] = outer[1]
  const inner = s.match(new RegExp('内径\\s*[:：]?\\s*' + DIM))
  if (inner) out['炭棒内径'] = inner[1]
  // 长的关键词排前面，避免「出货长度」被「长度」截半
  const len = s.match(new RegExp('(?:出货长度|总长|长度)\\s*[:：]?\\s*' + DIM))
  if (len) out['炭棒出货长度'] = len[1]
  return out
}
