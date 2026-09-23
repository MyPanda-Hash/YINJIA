/**
 * 配方计算引擎常量 —— 逐字对齐《炭棒工艺配方设计器》exe 的 `app.domain.constants`
 * (PyInstaller 归档取出的真源码,ENGINE_VERSION 1.0.0)。
 *
 * ⚠ 改任何常量或公式都必须同时:
 *   ① 升 ENGINE_VERSION;② 重跑 `node --test src/core/mold/recipeEngine.test.js`
 *   (黄金向量由 exe 真引擎产出,见 tools/archive/_gen-recipe-golden.py)。
 */

/** 与 exe 的 ENGINE_VERSION 同步:公式口径变了就升这个号 */
export const ENGINE_VERSION = '1.0.0'

/** 圆周率取 3.14 —— 不是 Math.PI(用真 π 会与车间沿用了多年的口径差千分之 0.5) */
export const PI = 3.14

/** 体积换算除数:mm³ → cm³ 的 1000 × 圆面积的 4,合起来就是 π×d²/4000 */
export const VOLUME_DIVISOR = 4000

/** 成型长度的固定料头 10mm */
export const BLANK_LENGTH_BASE = 10

/** 每个腔额外加的料头 3mm */
export const BLANK_LENGTH_PER_CAVITY = 3

/** 成型长度公差默认 ±2.5mm */
export const DEFAULT_LENGTH_TOL = 2.5

/** 脱模重量漂移系数默认 1.0(设计源 Excel 用硬编码 99.5%/100.5%,exe 改为可输入) */
export const DEFAULT_DEMOLD_LOW_FACTOR = 1.0
export const DEFAULT_DEMOLD_HIGH_FACTOR = 1.0

/** 料位分组(0 基):粉料 5 位 / 胶粉 2 位 / 折算料 3 位 */
export const POWDER_SLOTS = [0, 1, 2, 3, 4]
export const GLUE_SLOTS = [5, 6]
export const CONVERTED_SLOTS = [7, 8, 9]

/** 折算比的合法区间,越界只告警不拦 */
export const CONVERSION_RATIO_MIN = 0.0
export const CONVERSION_RATIO_MAX = 1.0

/** 结果里的 strategy 固定值(原表口径:补差位兜底) */
export const STRATEGY_LEGACY = 'LEGACY'

/** 料位总数 */
export const SLOT_COUNT = 10
