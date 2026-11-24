// 只读:到**生产** MES(36.140.66.163:8090)取 YJ-20261117-01 的头与明细,看同步落库的样子
const API = process.env.MES_API || 'http://36.140.66.163:8090/api';
const USER = process.env.MES_USER || 'admin';
const PASS = process.env.MES_PASS || '123456';
const panel = process.argv[2] || 'PU_ORDER';
const code = process.argv[3] || 'YJ-20261117-01';

const call = async (path, body, token) => {
  const r = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* */ }
  return { status: r.status, code: j?.code, message: j?.message || t.slice(0, 300), data: j?.data };
};

const lg = await call('/auth/login', { userName: USER, password: PASS });
if (!lg.data?.token) { console.error('登录失败:', lg.status, lg.message); process.exit(1); }
const token = lg.data.token;
console.log('登录成功');

const login = await call('/px/getFormDescriptor?panelCode=' + encodeURIComponent(panel) +
  '&code=' + encodeURIComponent(code), null, token);
const d = login.data || {};
const head = d.data || d.head || d;
const pickKeys = ['单据编号', '单据日期', '供应商', '单据状态', '审核人', '审核时间', '数据来源',
  '外部数据ID', '外部单据号', '外部指纹', '创建时间', '修改时间', '关闭状态',
  'asp_user1', 'asp_time1', 'asp_user2', 'asp_time2'];
const headOut = {};
for (const k of pickKeys) if (head && k in head) headOut[k] = head[k];
console.log('\n== 生产 MES 头部(节选)==');
console.log(JSON.stringify(headOut, null, 1));
if (head && !('外部指纹' in head)) console.log('头部实际键:', Object.keys(head).join(', '));

const dd = d.detailData || d.detail || {};
console.log('\n== 明细 keys ==', Object.keys(dd).join(', '));
for (const [k, rows] of Object.entries(dd)) {
  if (!Array.isArray(rows)) { console.log(`(${k} 非数组)`); continue; }
  console.log(`-- ${k}: ${rows.length} 行 --`);
  for (const r of rows) {
    console.log(JSON.stringify({ id: r.id, 行号: r.行号, 物料编码: r.物料编码, 物料名称: r.物料名称,
      规格型号: r.规格型号, 数量: r.数量, 单价: r.单价, 金额: r.金额, asp_time1: r.asp_time1, asp_time2: r.asp_time2 }));
  }
}

