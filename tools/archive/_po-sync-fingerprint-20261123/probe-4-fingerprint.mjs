// 只读:把「11-19 落库时的指纹输入」与「金蝶现在列表行的指纹输入」逐项摊开比
// 结论要证明的是:窗口(近31天)把它列进来了,但指纹 9 项一个都没变 ⇒ 判「无变化跳过」
import { readFileSync } from 'node:fs';
const API = process.env.MES_API || 'http://36.140.66.163:8090/api';
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { fetchAppToken, kingdeeGet } = await import('../../../deploy/kingdee-client.mjs');
const call = async (path, body, token) => {
  const r = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { }
  return { status: r.status, code: j?.code, message: j?.message || t.slice(0, 200), data: j?.data };
};
const NO = process.argv[2] || 'YJ-20261117-01';
const mesTok = (await call('/auth/login', { userName: 'admin', password: '123456' })).data?.token;
const { token: kTok } = await fetchAppToken(cfg.kingdee);

// 金蝶:列表行 = 同步器拿到的那 18 个键
const list = await kingdeeGet(cfg.kingdee, kTok, '/jdy/v2/scm/pur_order', { bill_no: NO, page: '1', page_size: '5' });
const k = (list.rows || [])[0] || {};
// MES:库里那行(11-19 落库时写进去的头字段)
const q = await call('/px/queryFormDataList', { panelCode: 'PU_ORDER', keyword: NO, condition: {}, pageNo: 1, pageSize: 3 }, mesTok);
const m = (q.data?.list || [])[0] || {};

const pairs = [
  ['bill_status', k.bill_status, '单据状态'],
  ['bill_close_state', k.bill_close_state, '关闭状态'],
  ['bill_date', k.bill_date, '单据日期'],
  ['supplier_name', k.supplier_name, '供应商'],
  ['supplier_number', k.supplier_number, '供应商编码'],
  ['emp_name', k.emp_name, '业务员名称'],
  ['io_status', k.io_status, '入库状态'],
  ['real_io_status', k.real_io_status, '实际出入库状态'],
  ['remark', k.remark, '备注'],
];
console.log('金蝶列表行(指纹来源,18 键里的 9 项)      MES 库里那行(11-19 落库)      同?');
let allSame = true;
for (const [kk, kv, mesh] of pairs) {
  const mv = m[mesh];
  const same = String(kv ?? '') === String(mv ?? '');
  if (!same) allSame = false;
  console.log(`${kk.padEnd(18)} = ${JSON.stringify(kv ?? '')}`.padEnd(52) + `| ${mesh} = ${JSON.stringify(mv ?? '')}`.padEnd(40) + (same ? 'OK' : '✗ 不同'));
}
const fpNow = pairs.map(([, kv]) => (kv === undefined || kv === null ? '' : String(kv))).join('|');
console.log('\n现在的指纹串  =', fpNow);
console.log('MES 记录的(11-19)=', pairs.map(([, , mesh]) => (m[mesh] === undefined || m[mesh] === null ? '' : String(m[mesh]))).join('|'));
console.log('\n9 项全同 ⇒ 指纹相同 ⇒ 「无变化跳过」;窗口(近31天)只保证它出现在列表里,不保证会重写明细');
console.log('明细本身在列表接口里根本没有:', ['qty', 'amount', 'material_entity'].map((x) => x + '=' + (x in k)).join(', '));

