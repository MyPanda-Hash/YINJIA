/**
 * testParamSpec.js — 规格书「检验方法」里那几个**测试参数** → 成型工艺清单对应格
 * (纯函数,可 node --test 断言)
 *
 * 用户口径(2026-10-16,「接着做」):测试间距mm / 压头下降速度 / 压降测试流速 也按规格书带出。
 * 这三个值不在「检验要求」里,而在**检验方法**那句话里 —— 实测 SD-2026-10-0010:
 *   强度·*抗压强度 的方法:「…调整间距40mm,设置下压速度5mm/min,按测试键…」     → 40 / 5
 *   #*压降        的方法:「…测试流速0.9L/min,滤前前后接装压力表…」            → 0.9
 *
 * 三条口径(与 dimensionSpec.js / dropSpec.js 同款):
 *   ① **只认锚点词**:`间距`/`下压速度|压头下降速度|下降速度`/`测试流速` ——
 *      同一句里还有「距离滤芯接口位置长度**50mm**」「通水**10min**」这类相近数字,
 *      不锚定就会把 50 当成间距、把 10 当成速度(实测句式里它们就在同一行);
 *   ② 抠不出来 ⇒ 那个键**不出现**(绝不写半截值/0);
 *   ③ 偏差原样带符号(实测 `测试流速0.9±0.1L/min` 这类写法要存成 `0.9±0.1`)——
 *      与 dimensionSpec 的 ±0.5 同一口径:那格语义是"带偏差的量",不是纯数字。
 *
 * 全角/半角都认(先折半角再去空白):检验方法是人工填的,`间距４０ｍｍ` 与 `间距40mm` 必须同解。
 */

/** 全角 → 半角(U+FF01..U+FF5E 整体平移 0xFEE0;全角空格单独折成普通空格)*/
function toHalfWidth(s) {
  return String(s ?? '')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
}

/** 数字 + 可选偏差:`40` / `0.9±0.1` / `5 +-0.2` */
const NUM = '([0-9]+(?:\\.[0-9]+)?)(?:\\s*(±|\\+/-|\\+-)\\s*([0-9]+(?:\\.[0-9]+)?))?'

/** 抠出来的值:有偏差就带符号(与 dimensionSpec 的 ±0.5 同口径) */
function numWithTol(m) {
  return m[2] && m[3] ? `${m[1]}${m[2] === '±' ? '±' : '±'}${m[3]}` : m[1]
}

/**
 * @param {string|null|undefined} text 该检验项目的「检验方法」原文
 * @returns {Record<string,string>} **只含解析成功的格**:
 *   { 测试间距mm?, 压头下降速度?, 压降测试流速? }
 */
export function parseTestMethod(text) {
  const out = {}
  const raw = String(text ?? '').trim()
  if (!raw) return out
  const s = toHalfWidth(raw).replace(/\s+/g, '')

  const sp = s.match(new RegExp('间距[:：]?' + NUM + 'mm'))
  if (sp) out['测试间距mm'] = numWithTol(sp)

  const spd = s.match(new RegExp('(?:压头下降速度|下降速度|下压速度)[:：]?' + NUM + 'mm/min'))
  if (spd) out['压头下降速度'] = numWithTol(spd)

  const flow = s.match(new RegExp('测试流速[:：]?' + NUM + '(?:L/min|L\\/min)?'))
  if (flow) out['压降测试流速'] = numWithTol(flow)

  return out
}
