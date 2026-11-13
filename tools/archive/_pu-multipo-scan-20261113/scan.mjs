// 探针:真实账套(金蝶云星辰 359797)全量扫描「采购入库单(pur_inbound)」
// 目的:回答「一张采购入库单里能不能/有没有出现不同采购订单的行(按 src_bill_no + src_seq 对应)」
// 只读:列表接口取 id/bill_no,逐单详情接口取 material_entity 的 src_* 族,统计每单不同 src_bill_no 个数。
// 用法(仓库根目录): node tools/archive/_pu-multipo-scan-20261113/scan.mjs [并发数] [每秒请求数]
// 输出:同目录 result.json + 控制台摘要。限流:账套级 500 次/分钟,本脚本默认 4 次/秒(240/分)。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, '../../../deploy/config.json'), 'utf8')).kingdee;
const CONC = Number(process.argv[2] || 4);
const RPS = Number(process.argv[3] || 4);

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── 简易令牌桶:限制每秒请求数(多并发共享)
let nextAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function throttle() {
  const now = Date.now();
  const at = Math.max(now, nextAt);
  nextAt = at + 1000 / RPS;
  if (at > now) await sleep(at - now);
}

const { token, domain } = await fetchAppToken(cfg);
log('token ok, domain =', domain);

// ── 1) 列表:所有采购入库单 id / bill_no / 日期 / 供应商
const docs = [];
for (let page = 1; ; page++) {
  await throttle();
  const l = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: String(page), page_size: '200' });
  const rows = l.rows || [];
  if (!rows.length) break;
  for (const r of rows) docs.push({ id: r.id, bill_no: r.bill_no, bill_date: r.bill_date, supplier: r.supplier_name, status: r.bill_status });
  const total = Number(l.count);
  log(`list page ${page}: +${rows.length} (${docs.length}/${total})`);
  if (docs.length >= total) break;
}
const uniq = new Map(docs.map((d) => [String(d.id), d]));
log('docs =', uniq.size);

// ── 2) 逐单详情:统计 src_bill_no / src_seq
const results = [];
let done = 0, failed = 0;
const list = [...uniq.values()];
async function worker(slice) {
  for (const d of slice) {
    let rec = { id: d.id, bill_no: d.bill_no, date: d.bill_date, supplier: d.supplier, status: d.status };
    try {
      await throttle();
      const det = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound_detail', { id: d.id });
      const lines = det.material_entity || [];
      const srcs = [...new Set(lines.map((m) => (m.src_bill_no == null ? '' : String(m.src_bill_no).trim())).filter(Boolean))];
      const noSrc = lines.filter((m) => !m.src_bill_no).length;
      rec.lines = lines.length;
      rec.srcKinds = srcs.length;
      rec.srcBills = srcs;
      rec.linesWithoutSrc = noSrc;
      rec.srcSeqMissing = lines.filter((m) => m.src_bill_no && !m.src_seq).length;
      if (srcs.length > 1) {
        rec.detail = lines.map((m) => ({
          seq: m.seq, material: m.material_number, name: m.material_name, qty: m.qty,
          src_bill_no: m.src_bill_no, src_seq: m.src_seq, src_bill_date: m.src_bill_date, src_entry_id: m.src_entry_id,
        }));
      }
    } catch (e) {
      failed++; rec.error = String(e.message || e).slice(0, 160);
    }
    results.push(rec);
    if (++done % 100 === 0) log(`detail ${done}/${list.length} (fail ${failed})`);
  }
}
const slices = Array.from({ length: CONC }, () => []);
list.forEach((d, i) => slices[i % CONC].push(d));
await Promise.all(slices.map(worker));

// ── 3) 汇总
const multi = results.filter((r) => r.srcKinds > 1).sort((a, b) => String(a.date).localeCompare(String(b.date)));
const one = results.filter((r) => r.srcKinds === 1);
const zero = results.filter((r) => r.srcKinds === 0);
const summary = {
  scannedAt: new Date().toISOString(),
  account: cfg.clientId,
  docs: results.length,
  failed,
  withMultiSrcBill: multi.length,
  withSingleSrcBill: one.length,
  withoutSrcBill: zero.length,
  linesTotal: results.reduce((s, r) => s + (r.lines || 0), 0),
  linesWithoutSrc: results.reduce((s, r) => s + (r.linesWithoutSrc || 0), 0),
};
// 落盘瘦身:多订单单保留逐行明细(证据),其余只留单级摘要(3.6k 行 × 摘要 ≈ 可提交)
const byMonth = {};
for (const r of results) {
  const m = String(r.date || '').slice(0, 7);
  byMonth[m] = byMonth[m] || { docs: 0, multi: 0 };
  byMonth[m].docs++;
  if (r.srcKinds > 1) byMonth[m].multi++;
}
const all = results.map((r) => ({
  bill_no: r.bill_no, date: r.date, supplier: r.supplier, lines: r.lines,
  srcKinds: r.srcKinds || 0, linesWithoutSrc: r.linesWithoutSrc, srcSeqMissing: r.srcSeqMissing,
  status: r.status, srcBills: r.srcBills,
}));
writeFileSync(join(HERE, 'scan-result.json'),
  JSON.stringify({ summary, byMonth, multi: multi.map((r) => ({ ...r, error: undefined })), all }), 'utf8');
log('SUMMARY', JSON.stringify(summary));
for (const r of multi) log(`MULTI ${r.bill_no} ${r.date} ${r.supplier} 行=${r.lines} 订单=${r.srcBills.join(' | ')}`);
