// 单测:采购入库单驱动的订单行刷新(2026-11-26 方案二)
// 跑法:cd deploy && node --test inbound-watch.test.mjs
//      或 cd deploy && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PO_NO_PATTERN,
  computeScanWindow,
  inboundWatchedPoNos,
  isMesPoNo,
  isPurchaseOrderSource,
  scanInboundPoNos,
} from './inbound-watch.mjs';

const DAY = 86400000;
const MIN = 60000;

test('订单号识别:只认本账套的 YJ-日期-流水', () => {
  assert.equal(PO_NO_PATTERN.test('YJ-20261111-06'), true);
  assert.equal(isMesPoNo('YJ-20261111-06'), true);
  assert.equal(isMesPoNo('  YJ-20260921-10  '), true); // 金蝶字段可能带空格
  assert.equal(isMesPoNo('CGRK-20261125-03863'), false, '入库单号不是订单号');
  assert.equal(isMesPoNo('YJ-20261111'), false, '缺流水段不算');
  assert.equal(isMesPoNo(''), false);
  assert.equal(isMesPoNo(undefined), false);
});

test('来源类型:缺键按「是采购订单」处理(宁多刷不漏收)', () => {
  assert.equal(isPurchaseOrderSource({ src_bill_type_number: 'pur_bill_order' }), true);
  assert.equal(isPurchaseOrderSource({}), true);
  assert.equal(isPurchaseOrderSource(null), true);
  assert.equal(isPurchaseOrderSource({ src_bill_type_number: 'sale_order' }), false);
});

test('扫描窗口:首次运行回看 firstRunDays', () => {
  const now = Date.UTC(2026, 10, 26, 13, 0, 0);
  const w = computeScanWindow({ nowMs: now, lastUntilMs: null, firstRunDays: 7, overlapMinutes: 20 });
  assert.equal(w.untilMs, now);
  assert.equal(w.sinceMs, now - 7 * DAY);
  assert.equal(w.firstRun, true);
});

test('扫描窗口:有水位线时只回看 overlap(同步停几天也能补扫)', () => {
  const now = Date.UTC(2026, 10, 26, 13, 0, 0);
  const last = now - 3 * DAY; // 上次成功扫到 3 天前
  const w = computeScanWindow({ nowMs: now, lastUntilMs: last, firstRunDays: 7, overlapMinutes: 20 });
  assert.equal(w.sinceMs, last - 20 * MIN, '从水位线往前叠 20 分钟,3 天窗口自动补上');
  assert.equal(w.firstRun, false);
});

test('扫描窗口:--inbound-window-days 覆盖水位线(一次性补扫)', () => {
  const now = Date.UTC(2026, 10, 26, 13, 0, 0);
  const w = computeScanWindow({ nowMs: now, lastUntilMs: now - 5 * MIN, firstRunDays: 7, overlapMinutes: 20, overrideDays: 31 });
  assert.equal(w.sinceMs, now - 31 * DAY);
  assert.equal(w.firstRun, false);
});

test('扫描窗口:水位线超前(时钟回拨)时窗口不反转', () => {
  const now = Date.UTC(2026, 10, 26, 13, 0, 0);
  const w = computeScanWindow({ nowMs: now, lastUntilMs: now + 10 * MIN, firstRunDays: 7, overlapMinutes: 20 });
  assert.equal(w.sinceMs, now - 10 * MIN, 'last−overlap 仍在 now 之前 ⇒ 照常回看');
  const w2 = computeScanWindow({ nowMs: now, lastUntilMs: now + 30 * MIN, firstRunDays: 7, overlapMinutes: 20 });
  assert.equal(w2.sinceMs, w2.untilMs, 'last−overlap 超过 now ⇒ 夹到 until,窗口不反转');
  assert.ok(w2.sinceMs <= w2.untilMs);
});

/** 造一个假的 kingdeeGet:按 path/params 返回钉死的数据 */
function fakeFetcher({ list, detail }) {
  const calls = [];
  const fn = async (cfg, token, path, params) => {
    calls.push({ path, params });
    if (path.endsWith('_detail')) {
      const r = detail[String(params.id)];
      if (r instanceof Error) throw r;
      return r;
    }
    return typeof list === 'function' ? list(params) : list;
  };
  fn.calls = calls;
  return fn;
}

test('扫描:拆出采购订单号、去重、忽略非订单源单', async () => {
  const fetchJson = fakeFetcher({
    list: { count: 2, total_page: 1, rows: [{ id: '1', bill_no: 'CGRK-20261125-03863' }, { id: '2', bill_no: 'CGRK-20261126-03862' }] },
    detail: {
      1: { material_entity: [
        { src_bill_no: 'YJ-20261111-06', src_bill_type_number: 'pur_bill_order' },
        { src_bill_no: 'YJ-20260921-10', src_bill_type_number: 'pur_bill_order' },
        { src_bill_no: 'SO-20261101-01', src_bill_type_number: 'pur_bill_order' }, // 不是采购订单号
      ] },
      2: { material_entity: [
        { src_bill_no: 'YJ-20261111-06', src_bill_type_number: 'pur_bill_order' }, // 与 1 重复
        { src_bill_no: '', src_bill_type_number: 'pur_bill_order' }, // 空
      ] },
    },
  });
  const r = await scanInboundPoNos({
    kingdeeCfg: {}, token: 't', sinceMs: 0, untilMs: 1, detailGapMs: 0, fetchJson,
  });
  assert.deepEqual(r.poNos.sort(), ['YJ-20260921-10', 'YJ-20261111-06']);
  assert.equal(r.docs, 2);
  assert.equal(r.detailFail, 0);
  assert.equal(r.capped, false);
});

test('扫描:单张明细失败只记账,不拖垮整轮', async () => {
  const fetchJson = fakeFetcher({
    list: { count: 2, total_page: 1, rows: [{ id: '1' }, { id: '2' }] },
    detail: {
      1: { material_entity: [{ src_bill_no: 'YJ-20261111-06' }] },
      2: new Error('HTTP 500'),
    },
  });
  const r = await scanInboundPoNos({ kingdeeCfg: {}, token: 't', sinceMs: 0, untilMs: 1, detailGapMs: 0, fetchJson });
  assert.deepEqual(r.poNos, ['YJ-20261111-06']);
  assert.equal(r.detailFail, 1);
});

test('扫描:命中订单上限即截断并标记 capped(水位线不推进)', async () => {
  const fetchJson = fakeFetcher({
    list: { count: 1, total_page: 1, rows: [{ id: '1' }] },
    detail: { 1: { material_entity: [{ src_bill_no: 'YJ-20261111-06' }, { src_bill_no: 'YJ-20261112-10' }] } },
  });
  const r = await scanInboundPoNos({ kingdeeCfg: {}, token: 't', sinceMs: 0, untilMs: 1, maxPoNos: 1, detailGapMs: 0, fetchJson });
  assert.equal(r.poNos.length, 1);
  assert.equal(r.capped, true);
});

test('编排:成功后推进水位线;干跑/明细失败时不推进', async () => {
  const list = { count: 0, total_page: 1, rows: [] };
  const okFetch = fakeFetcher({ list, detail: {} });

  let saved = 0;
  const state = {};
  const pos = await inboundWatchedPoNos({
    kingdeeCfg: {}, token: 't', state, saveState: () => { saved++; },
    options: { fetchJson: okFetch, firstRunDays: 7, detailGapMs: 0 },
    nowMs: Date.UTC(2026, 10, 26, 13, 0, 0),
  });
  assert.deepEqual(pos, []);
  assert.equal(saved, 1, '成功一轮要推进水位线');
  assert.equal(state.inboundWatchUntil, Date.UTC(2026, 10, 26, 13, 0, 0));

  // 干跑:扫描但不推进
  const state2 = {};
  let saved2 = 0;
  await inboundWatchedPoNos({
    kingdeeCfg: {}, token: 't', state: state2, saveState: () => { saved2++; },
    options: { fetchJson: okFetch, detailGapMs: 0 }, dryRun: true,
  });
  assert.equal(saved2, 0);
  assert.equal(state2.inboundWatchUntil, undefined);

  // 有明细失败:本轮不推进,下一轮重扫(否则那单的收货会被永久跳过)
  const failFetch = fakeFetcher({
    list: { count: 1, total_page: 1, rows: [{ id: '9' }] },
    detail: { 9: new Error('HTTP 500') },
  });
  const state3 = {};
  let saved3 = 0;
  await inboundWatchedPoNos({
    kingdeeCfg: {}, token: 't', state: state3, saveState: () => { saved3++; },
    options: { fetchJson: failFetch, detailGapMs: 0 },
  });
  assert.equal(saved3, 0);
  assert.equal(state3.inboundWatchUntil, undefined);
});
