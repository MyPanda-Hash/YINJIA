// 探针③:排除项核查 —— 委外/生产任务/领料申请/调拨申请/库存流水 等候选接口在真实账套是否存在、有无数据(只读)
// 用法: node tools/archive/_kingdee-io-bills-20261113/probe-extra-types.mjs
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const paths = [
 ['委外加工单','/jdy/v2/pm/subm_workorder'],
 ['委外领料','/jdy/v2/pm/subm_pick'],
 ['委外入库','/jdy/v2/pm/subm_inbound'],
 ['委外入库(别名)','/jdy/v2/scm/subm_inbound'],
 ['委外领料(别名)','/jdy/v2/scm/subm_pick'],
 ['生产任务单','/jdy/v2/pm/mo_taskbill'],
 ['领料申请','/jdy/v2/scm/pick_apply'],
 ['调拨申请','/jdy/v2/scm/inv_tfapply'],
 ['拆卸单(别名)','/jdy/v2/scm/inv_disassemble_bill'],
 ['库存流水','/jdy/v2/scm/inv_inout_detail'],
 ['出入库明细','/jdy/v2/inv/inv_inout_detail'],
];
for (const [label, p] of paths) {
  const r = await kingdeeTryGet(cfg.kingdee, token, p, { page: '1', page_size: '5' });
  console.log(r.ok ? `✅ ${label.padEnd(12)} ${p} count=${r.data?.count} rows=${(r.data?.rows||[]).length}` : `❌ ${label.padEnd(12)} ${p} → ${r.error}`);
  await new Promise((x) => setTimeout(x, 130));
}

