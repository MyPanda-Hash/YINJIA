// 金蝶「采购入库单」→ 采购订单行执行量(已入库 / 未入库)的实时刷新 · 方案二(2026-11-26)
//
// ── 要解决的问题 ─────────────────────────────────────────────────────────────
// 增量同步只拉「近 windowDays(默认 31)天被修改过」的采购订单 ⇒ 单头不再改动的老订单,
// 行级 in_qty / un_out_qty 永远不重取,现场看到的「金蝶未入库」是几天前甚至几个月前的旧数。
// 实例(2026-11-26 客户报障):采购订单 YJ-20260921-10(2026-09-21)行3 YJ-SX-046,
// 金蝶真值 已入库 4135 / 未入库 865,MES 显示 0 / 5000 ⇒ 客户据此又收一次 1000,超收 135。
//
// ── 方案二:把「谁收了货」当成触发源 ─────────────────────────────────────────
// 每轮按 modify_time 增量拉**采购入库单**(含暂存→审核、弃审、红冲等状态变化),
// 取每行的 src_bill_no(来源采购订单号),把涉及的订单并入本轮的「强制补拉」名单
// (sync-core 的 autoRefreshPos 通道:不受 31 天窗口 + 表头指纹限制,详情必刷)。
// 于是无论货是 MES 转ERP 推过去的、还是别人在金蝶里手工录的,MES 都能在 5 分钟内看见。
//
// ── 为什么只做「触发器」、不自己算已入库量 ──────────────────────────────────
// 金蝶订单行的 un_out_qty 已经把超收(负数)、退货、换算率、单据状态口径全算好了;
// 自己拿入库单明细求和,这三处会各错一次(2026-11-23 实测过超收 -1800 / -1000 的死行)。
// ⇒ 数量仍以**金蝶采购订单行**为唯一真值,本模块只负责「把这张订单再拉一遍」。
//
// ── 水位线(为什么不是每轮都扫 31 天)───────────────────────────────────────
// state.json 里记 inboundWatchUntil:每轮从「上轮成功时间 − overlap」扫到 now,
// 正常一轮只有几分钟的单据(实测 31 天 475 张 ≈ 15 张/天);同步停过几天也能自动补扫,
// 因为水位线只在扫描**成功后**推进。首次运行(没有水位线)回看 firstRunDays 天。
//
// ── 已知边界(写在这里免得以后当成 bug 查)──────────────────────────────────
// 1. 只看采购入库单:若金蝶里用其它单据类型回冲(本账套 /jdy/v2/scm/pur_inbound_rt 等端点均 519 不可用),
//    这里看不见;但订单行数量仍会在下一次「该单有任何入库动作」时被纠正。
// 2. 单据被**物理删除**时列表不再返回它 ⇒ 不会触发补拉;靠「明细每日复核日戳」兜住窗口内的单。
// 3. 采购入库单列表只回表头 19 个键,src_bill_no 必须逐单取详情(1 次/单)。
import { kingdeeGet } from './kingdee-client.mjs';

/** 采购入库单 列表/详情端点(金蝶云·星辰) */
export const INBOUND_LIST_PATH = '/jdy/v2/scm/pur_inbound';
export const INBOUND_DETAIL_PATH = '/jdy/v2/scm/pur_inbound_detail';

/** MES 采购订单号形如 YJ-20261111-06;本账套的订单号规则(其它前缀不会被当成订单触发) */
export const PO_NO_PATTERN = /^YJ-\d{8}-\d+$/;

/** 默认参数:与水印叠加后,正常一轮只扫最近 20 分钟,不会把 31 天重扫一遍 */
export const INBOUND_WATCH_DEFAULTS = Object.freeze({
  firstRunDays: 7, // 首次运行(无水位线)回看天数 —— 覆盖计划任务刚上线/停机一周
  overlapMinutes: 20, // 每轮回看重叠,抵掉列表可见性延迟与上一轮失败
  pageSize: 100,
  maxPages: 10, // 单轮最多翻 1000 张入库单(防端点异常时死循环)
  maxPoNos: 200, // 单轮最多触发 200 张订单(与 pendingPoNos 的 200 张上限同口径)
  detailGapMs: 120, // 逐单取详情的节流(与 sync-core 的详情节流一致)
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nz = (v) => (v === undefined || v === null ? '' : String(v).trim());

/** 是不是本账套的采购订单号(空/其它前缀一律 false) */
export function isMesPoNo(value) {
  return PO_NO_PATTERN.test(nz(value));
}

/**
 * 入库单行是不是「采购订单」来源。
 * src_bill_type_number 实测为 'pur_bill_order';缺键时按"是"(只要订单号形似就收),
 * 宁可多刷一张订单,也不要漏掉一次收货。
 */
export function isPurchaseOrderSource(line) {
  const t = nz(line && line.src_bill_type_number);
  return !t || t === 'pur_bill_order';
}

/**
 * 算本轮扫描窗口 [sinceMs, untilMs)。
 *
 * @param {object} p
 * @param {number} p.nowMs            当前时间
 * @param {number|null} p.lastUntilMs 上轮成功扫到的时间(无则视为首次运行)
 * @param {number} [p.firstRunDays]   首次运行回看天数
 * @param {number} [p.overlapMinutes] 重叠回看分钟数
 * @param {number|null} [p.overrideDays] 手工指定回看天数(--inbound-window-days):忽略水位线
 * @returns {{sinceMs:number, untilMs:number, firstRun:boolean}}
 */
export function computeScanWindow({ nowMs, lastUntilMs, firstRunDays, overlapMinutes, overrideDays } = {}) {
  const untilMs = Number(nowMs) || Date.now();
  const overlap = (Number.isFinite(overlapMinutes) ? overlapMinutes : INBOUND_WATCH_DEFAULTS.overlapMinutes) * 60000;
  if (Number.isFinite(overrideDays) && overrideDays > 0) {
    return { sinceMs: untilMs - overrideDays * 86400000, untilMs, firstRun: false };
  }
  const last = Number.isFinite(lastUntilMs) && lastUntilMs > 0 ? lastUntilMs : null;
  const firstRun = !last;
  const base = firstRun
    ? untilMs - (Number.isFinite(firstRunDays) ? firstRunDays : INBOUND_WATCH_DEFAULTS.firstRunDays) * 86400000
    : last - overlap;
  return { sinceMs: Math.min(base, untilMs), untilMs, firstRun };
}

/**
 * 扫描窗口内的采购入库单,返回「被收货触发的采购订单号」。
 * 只读:不写库、不写状态。
 *
 * @returns {Promise<{poNos:string[], docs:number, detailFail:number, capped:boolean, pages:number}>}
 */
export async function scanInboundPoNos({
  kingdeeCfg,
  token,
  sinceMs,
  untilMs,
  pageSize = INBOUND_WATCH_DEFAULTS.pageSize,
  maxPages = INBOUND_WATCH_DEFAULTS.maxPages,
  maxPoNos = INBOUND_WATCH_DEFAULTS.maxPoNos,
  detailGapMs = INBOUND_WATCH_DEFAULTS.detailGapMs,
  log = () => {},
  fetchJson = kingdeeGet, // 可注入(单测用):签名与 kingdeeGet(cfg, token, path, params) 一致
} = {}) {
  const poSet = new Set();
  let docs = 0;
  let detailFail = 0;
  let pages = 0;
  let capped = false;

  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchJson(kingdeeCfg, token, INBOUND_LIST_PATH, {
      page: String(page),
      page_size: String(pageSize),
      modify_start_time: String(sinceMs),
      modify_end_time: String(untilMs),
    });
    pages = page;
    const rows = data.rows || [];
    for (const row of rows) {
      docs++;
      let detail;
      try {
        detail = await fetchJson(kingdeeCfg, token, INBOUND_DETAIL_PATH, { id: String(row.id) });
      } catch (e) {
        // 单张明细失败不算整轮失败:记一笔,下一轮(水位线未推进到该单之后)还会再试
        detailFail++;
        log(`⚠ 【采购入库】${nz(row.bill_no) || row.id} 明细取不到:${e.message}`);
        continue;
      }
      for (const line of detail.material_entity || []) {
        if (!isPurchaseOrderSource(line)) continue;
        const poNo = nz(line.src_bill_no);
        if (!isMesPoNo(poNo)) continue; // 非本账套采购订单(或其它单据类型的源单)不参与触发
        poSet.add(poNo);
        if (poSet.size >= maxPoNos) { capped = true; break; }
      }
      if (capped) break;
      await sleep(detailGapMs);
    }
    if (capped) break;
    if (!rows.length || page >= Number(data.total_page || 1)) break;
  }

  return { poNos: [...poSet], docs, detailFail, capped, pages };
}

/**
 * 编排:算窗口 → 扫描 → 推进水位线 → 返回订单号。
 *
 * 水位线只在**扫描成功且未被上限截断**时推进;失败/截断时保持原值,下一轮自动重扫,
 * 避免「为了不重复扫而漏掉收货」。
 *
 * @param {object} p
 * @param {object} p.kingdeeCfg  金蝶配置(config.json 的 kingdee)
 * @param {string} p.token       app-token
 * @param {object} p.state       state.json 内容(会被就地修改)
 * @param {Function} [p.saveState] 落盘回调(不传/dryRun 时不推进水位线)
 * @param {object} [p.options]   INBOUND_WATCH_DEFAULTS 覆盖项
 * @param {number} [p.overrideDays] --inbound-window-days 指定的回看天数
 * @param {boolean} [p.dryRun]   干跑:照常扫描但不推进水位线
 * @param {Function} [p.log]
 */
export async function inboundWatchedPoNos({
  kingdeeCfg,
  token,
  state,
  saveState,
  options = {},
  overrideDays,
  dryRun = false,
  log = () => {},
  nowMs = Date.now(),
} = {}) {
  const opt = { ...INBOUND_WATCH_DEFAULTS, ...(options || {}) };
  const lastUntilMs = state ? Number(state.inboundWatchUntil) : null;
  const { sinceMs, untilMs, firstRun } = computeScanWindow({
    nowMs,
    lastUntilMs,
    firstRunDays: opt.firstRunDays,
    overlapMinutes: opt.overlapMinutes,
    overrideDays,
  });
  const spanMin = Math.round((untilMs - sinceMs) / 60000);
  log(`【采购入库】扫描窗口 ${new Date(sinceMs).toISOString().slice(0, 16).replace('T', ' ')} ~ now`
    + `(${spanMin} 分钟${firstRun ? ',首次运行' : ''}${Number.isFinite(overrideDays) ? `,--inbound-window-days=${overrideDays}` : ''})`);

  const result = await scanInboundPoNos({
    kingdeeCfg, token, sinceMs, untilMs,
    pageSize: opt.pageSize, maxPages: opt.maxPages, maxPoNos: opt.maxPoNos, detailGapMs: opt.detailGapMs, log,
    fetchJson: opt.fetchJson, // 单测注入;生产不传 ⇒ 走默认的 kingdeeGet
  });

  const note = result.capped ? `,命中上限 ${opt.maxPoNos} 张已截断(水位线不推进,下轮继续)` : '';
  log(`【采购入库】近 ${spanMin} 分钟入库单 ${result.docs} 张 → 涉及采购订单 ${result.poNos.length} 张`
    + `${result.detailFail ? `(明细失败 ${result.detailFail} 张)` : ''}${note}`);

  if (!dryRun && !result.capped && result.detailFail === 0 && state && typeof saveState === 'function') {
    state.inboundWatchUntil = untilMs;
    saveState();
  }
  return result.poNos;
}
