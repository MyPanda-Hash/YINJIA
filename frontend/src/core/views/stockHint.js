/**
 * stockHint.js — 库存口径提示(2026-11-10 用户口径「库存数量以金蝶真实账套为准」)
 *
 * 为什么单独一个文件:后端在 审核 / 审批通过 的返回体里带 `库存提示` 码,前端只要翻成一句人话。
 * 这类"口径文案 + 是否显示"的判断放进 PanelxList.vue(1.4 万行)就再也测不了 ——
 * 与 erpOutcome.js 同一套做法(那边也是为了"已转ERP还弹执行成功"那次报障才拆出来的)。
 *
 * 码值只两枚(与 ButtonService.result(def,no,status) 里写的完全一致):
 *   · 待转ERP    —— 会改库存且能推金蝶的单据:转ERP + 金蝶审核后才真正改库存;
 *   · 不推送金蝶 —— 调拨单/盘点单:转ERP 白名单里没有它们,审核不改变库存(只留流水)。
 */
export const STOCK_HINT_TEXT = {
  待转ERP: '库存以金蝶为准：本单需「转ERP」并在金蝶审核后才会改变库存（最长 5 分钟同步）',
  不推送金蝶: '库存以金蝶为准：调拨/盘点不推送金蝶，本单不改变库存（只留流水）',
}

/** 码 → 中文原句(走 tt() 显示);未知码返回空串(调用方据此不弹提示) */
export function stockHintText(code) {
  return (code && STOCK_HINT_TEXT[String(code)]) || ''
}
