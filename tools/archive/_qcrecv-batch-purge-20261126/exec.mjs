// 暂收单/检验单 清理执行器（只走线上接口：弃审 → 删除）
// 用法：
//   node exec.mjs plan            只打印将要做什么
//   node exec.mjs one <单号>      单张试跑
//   node exec.mjs run <清单文件>  按清单批量执行（JSON: {recv:[...], insp:[...]}）
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { login, post, queryPanel } from './api.mjs';

const LOG = 'exec-log.txt';
const log = (s) => { const line = `[${new Date().toISOString()}] ${s}`; console.log(line); appendFileSync(LOG, line + '\n', 'utf8'); };

async function callButton(panelCode, buttonName, no) {
  const r = await post('/px/callButton', { panelCode, buttonName, formData: { 编号: no }, buttonParam: {} });
  if (r.body.code !== 200) throw new Error(`${buttonName} 失败: ${r.body.message}`);
  return r.body.data;
}
async function del(panelCode, no) {
  const r = await post('/px/deleteForms', { panelCode, rowCodes: [no] });
  if (r.body.code !== 200) throw new Error(`删除 失败: ${r.body.message}`);
  return true;
}
async function statusOf(panelCode, no) {
  const d = await queryPanel(panelCode, { keyword: no, pageSize: 50 });
  const row = (d.list || []).find((x) => x['编号'] === no || x['单号'] === no || x['单据编号'] === no);
  return row ? { status: row['单据状态'], found: true } : { status: '不在列表', found: false };
}

/** 弃审（若已审核）+ 删除；返回 {no, audited, deleted, status, error} */
export async function purgeOne(panelCode, no, { inspNos = [] } = {}) {
  const out = { panelCode, no, audited: false, deleted: false, status: null, error: null };
  try {
    const st0 = await statusOf(panelCode, no);
    out.status = st0.status;
    if (!st0.found) { out.error = '不在列表(已处理)'; return out; }
    if (st0.status === '已作废') { out.error = '已是已作废'; return out; }
    if (st0.status === '已审核') {
      await callButton(panelCode, '弃审', no);
      out.audited = true;
      out.status = (await statusOf(panelCode, no)).status;
      log(`  弃审 OK → ${out.status}  (${panelCode} ${no})`);
    }
    // 先删下游检验单（若有），再删本单
    for (const ino of inspNos) {
      try {
        const st = await statusOf('QC_INSP', ino);
        if (!st.found) { log(`  检验单已不在列表 (${ino})`); continue; }
        if (st.status === '已审核') { await callButton('QC_INSP', '弃审', ino); log(`  检验单弃审 OK (${ino})`); }
        await del('QC_INSP', ino); log(`  检验单删除 OK (${ino})`);
      } catch (e) { log(`  ⚠ 检验单处理失败 ${ino}: ${e.message}`); out.inspError = e.message; }
    }
    await del(panelCode, no);
    out.deleted = true;
    out.status = (await statusOf(panelCode, no)).status;
    log(`  删除 OK → ${out.status}  (${panelCode} ${no})`);
  } catch (e) {
    out.error = e.message;
    log(`  ✗ 失败 ${panelCode} ${no}: ${e.message}`);
  }
  return out;
}

const [mode, arg] = process.argv.slice(2);
await login();
if (mode === 'plan') {
  const LIST = 'cleanup-list.json';
  const data = JSON.parse(readFileSync(LIST, 'utf8'));
  console.log(`暂收单 ${data.recv.length} 张，检验单 ${data.insp.length} 张`);
  const st = {}; for (const d of data.recv) st[d.status] = (st[d.status] || 0) + 1;
  console.log('状态分布:', JSON.stringify(st));
  console.log('检验单:', data.insp.join(', '));
} else if (mode === 'one') {
  const r = await purgeOne('QC_RECV', arg, { inspNos: process.argv.slice(4) });
  console.log(JSON.stringify(r, null, 1));
} else if (mode === 'run') {
  const data = JSON.parse(readFileSync(arg, 'utf8'));
  const results = [];
  for (const d of data.recv) {
    const inspNos = data.insp.filter((i) => i.recv === d.no).map((i) => i.no);
    results.push(await purgeOne('QC_RECV', d.no, { inspNos }));
  }
  const summary = results.reduce((a, r) => { const k = r.error ? 'FAIL' : 'OK'; a[k] = (a[k] || 0) + 1; return a; }, {});
  log(`批量完成 ${JSON.stringify(summary)}`);
  writeFileSync('exec-result.json', JSON.stringify(results, null, 1), 'utf8');
}
