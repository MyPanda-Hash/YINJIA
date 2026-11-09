/**
 * 分批送料对话框的「生单行」构造(纯函数 —— 便于 node --test 直接单测,不需要浏览器)。
 *
 * 用户报的缺陷(2026-09-21):
 *   「生单勾选明细时,只勾选一条生成也会变成全部生单。」
 * 病根:对话框把**勾选**和**本次送料量**两套信号混在一起 ——
 *   ① load() 给**每一行**都预填了「本次送料量 = 剩余量」;
 *   ② confirm() 只按 `qty > 0` 过滤,`picked`(勾选)收下来却**从未使用**。
 *   ⇒ 只勾一行,提交的仍是全部行(所有行 qty 都 > 0)。
 *
 * 修法(用户口径):**勾选是权威** ——
 *   · 只有"被勾选 且 本次送料量 > 0"的行才进入生单 payload;
 *   · 勾选/取消勾选只影响是否提交,不吞掉用户已填的数量(取消后重勾还能用);
 *   · 打开对话框时默认勾选"有剩余的行"(保留"打开即可全送"的便利),
 *     「按剩余量填充/清空」= 全选/全不选。
 *
 * 台账/后端契约不变:`lines = [{lineKey, qty}]`,后端只按 qty>0 的行生成
 * (PushGenerateHandler.generateBatch),所以这里**必须**先把未勾选的行滤掉。
 */

/** 勾选项 → lineKey 集合(组件里 picked 是 el-table 的选中行数组;也接受 lineKey 字符串数组) */
export function pickedKeySet(picked = []) {
  return new Set((picked || []).map((r) => (typeof r === 'string' ? r : r && r.lineKey)).filter(Boolean))
}

/** 默认勾选范围:还有剩余可送的行(lineKey 升序保持表格顺序) */
export function defaultPickKeys(rows = []) {
  return (rows || []).filter((r) => Number(r?.剩余数量 || 0) > 0).map((r) => r.lineKey)
}

/**
 * 生单 payload 行:仅"已勾选 且 数量 > 0"。
 * @param {Array} rows       对话框表格行(含 lineKey/剩余数量)
 * @param {Set|Array} picked 勾选项(lineKey 集合,或行数组)
 * @param {object} qtyOf     本次送料量:{ [lineKey]: number }
 */
export function buildBatchSendLines(rows = [], picked = [], qtyOf = {}) {
  const keys = picked instanceof Set ? picked : pickedKeySet(picked)
  const out = []
  for (const r of rows || []) {
    const key = r?.lineKey
    if (!key || !keys.has(key)) continue          // ← 未勾选:不送(本次修复的核心)
    const qty = Number(qtyOf?.[key] ?? 0)
    if (!(qty > 0)) continue                      // 勾了但没填量:视为不送
    out.push({ lineKey: key, qty })
  }
  return out
}

/** 本次合计:只算**已勾选**的行(未勾选行即使填了量也不计入,否则合计与生单结果不符) */
export function sumPickedQty(rows = [], picked = [], qtyOf = {}) {
  const keys = picked instanceof Set ? picked : pickedKeySet(picked)
  let sum = 0
  for (const r of rows || []) {
    const key = r?.lineKey
    if (!key || !keys.has(key)) continue
    sum += Number(qtyOf?.[key] ?? 0) || 0
  }
  return Math.round(sum * 100) / 100
}

/**
 * 分批送料「可送上限」(2026-09-22 口径):**按全部数量算** ——
 *   订单数量 + 超送量 − 已送 + 已退回,负数归 0。
 *
 * <p><b>2026-11-09 用户口径「要根据单位确定超送是否需要小数,如果需要小数要确定位数」</b>:
 * 超送量 = 订单数量 × 比例,按**该行单位的小数位数**向下取整(计件单位 → 整数,kg/米 → 3 位),
 * 上限本身也落到同一精度。24 个 × 20% 只能超送 4 个(不是 4.799999999999997,也不是 5)。
 *
 * <p>⚠ 精度由服务端逐行下发(`小数位数`,来源 bs_uom.小数位数,见 BatchService.unitDecimals);
 * 前端不自己猜单位精度,只按给定精度算与显示 —— 否则两边口径迟早对不上。
 *
 * @param orderQty 订单数量(原行:已由服务端扣掉打印量)
 * @param sent     已送
 * @param returned 已退回
 * @param ratioPct 超送比例百分数(0~50,超出按 50 钳制)
 * @param decimals 单位小数位数(缺省 2;计件单位服务端会给 0)
 */
export function overAllowance(orderQty, sent, returned, ratioPct = 0, decimals = 2) {
  const r = Math.max(0, Math.min(50, Number(ratioPct) || 0)) / 100
  const nd = Math.max(0, Math.min(4, Math.trunc(Number(decimals) || 0)))
  const qty = Number(orderQty || 0)
  const extra = floorTo(qty * r, nd)                       // 超送量:不超比例
  const v = qty + extra - Number(sent || 0) + Number(returned || 0)
  return v > 0 ? floorTo(v, nd) : 0
}

/** 按精度**向下取整**(与后端 UnitPrecision.floorTo 同一实现;1e-9 容差吃掉 4.7999…×100 的尾差) */
export function floorTo(v, decimals = 2) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  const nd = Math.max(0, Math.min(4, Math.trunc(Number(decimals) || 0)))
  const p = Math.pow(10, nd)
  return Math.floor(n * p + 1e-9) / p
}
