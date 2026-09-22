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
