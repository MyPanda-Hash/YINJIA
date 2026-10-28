/**
 * productCodeSuffix.js — 成型工艺清单「产品编号」的 -tb 后缀(纯函数,可 node --test)
 *
 * 【用户口径】2026-10-27(1027系统使用-产品工艺文件问题点待改善 #2):
 *   「【成型工艺清单页】点击选择产品编号之后,在产品编号后面自动添加 -tb 编号后缀」
 *   并明确「加在产品编号本身」(不是只在纸面显示)。
 *
 * 【为什么单独抽出来】
 *   这不是"显示格式"而是**数据键的改写**:写进 rd_mold_proc_head.产品编号 的值会变,
 *   而下游有好几处按这个值反查(首件检验取成型工艺清单、工单取成型配方、产品开发状态标注…)。
 *   规则只有三条,但每条错了都**不会报错**,只会"查不到" ⇒ 收敛成纯函数 + 单测钉住:
 *     ① 只有 RD_MOLD_PROC 加后缀,其它面板原样返回(没有这条口径);
 *     ② 幂等 —— 已经带 -tb 的不再叠(`00011-tb` 不会变成 `00011-tb-tb`);
 *     ③ 空值不加工 —— 绝不产出 `-tb` 这种只有后缀的脏值。
 *
 * 【历史数据兼容】存量单据的 产品编号 没有后缀。所有读取方都必须两种形态都认:
 *   · 前端:rawProductCode() 剥掉后缀再拿去查参照/下游;
 *   · 后端:FirstInspItems / WorkOrderRecipeService 的 SQL 用 LIKE 兜底(见两处注释)。
 *   ⇒ 老单据照常能查、能改、能审,不因本功能失效。
 */

/** 后缀常量(用户指定的小写 -tb,与产品编号之间用短横线) */
export const TB_SUFFIX = '-tb'

/** 哪些面板的「产品编号」要带后缀;只有成型工艺清单(RD_MOLD_PROC) */
const SUFFIX_PANELS = new Set(['RD_MOLD_PROC'])

/** 该面板的产品编号是否要加后缀 */
export function usesProductCodeSuffix(panelCode) {
  return SUFFIX_PANELS.has(String(panelCode || ''))
}

/**
 * 去掉可能的 -tb 后缀(大小写不敏感,容忍前后空格)。
 * 用于:重复选参照时防止叠加、按产品编号反查时取原始值。
 * @param {unknown} code
 * @returns {string} 去掉后缀的原始产品编号(无后缀则原样)
 */
export function rawProductCode(code) {
  const s = code === null || code === undefined ? '' : String(code).trim()
  if (!s) return ''
  // 只剥**结尾**那一层(与追加逻辑对称);中间出现 -tb 的业务编码不动
  return s.replace(/-tb$/i, '').trim()
}

/**
 * 按面板口径产出应写入「产品编号」的值。
 * @param {unknown} code      参照带回的原始产品编号(产品信息表的值)
 * @param {string}  panelCode 当前面板编码
 * @returns {string} 该面板应存的值(RD_MOLD_PROC ⇒ `<原值>-tb`;其它面板 ⇒ 原值)
 */
export function productCodeWithSuffix(code, panelCode) {
  const base = rawProductCode(code)
  // ③ 空值不加工:返回空串,绝不产出 '-tb'
  if (!base) return ''
  // ① 只对成型工艺清单加
  if (!usesProductCodeSuffix(panelCode)) return base
  // ② 幂等:rawProductCode 已剥过一层,这里直接拼,不会叠加
  return base + TB_SUFFIX
}
