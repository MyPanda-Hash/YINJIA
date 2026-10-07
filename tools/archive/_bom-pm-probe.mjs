// 探针:生产管理 BOM 接口核查 —— /jdy/v2/pm/bom(根据产品查询BOM)、/jdy/v2/bd/bom_query、
//       /jdy/v2/pm/bom_material(材料分录联动)、/jdy/v2/bd/bom_detail(BOM单详情)
// 先读官方文档拿请求参数,再按参数实测正式账套(打印原始返回/错误)。
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
async function doc(id) {
  const r = await fetch('https://open.jdy.com/api/document_info/content', { method: 'POST', headers: postHeaders(), body: JSON.stringify({ id }) });
  const j = await r.json();
  return { title: j?.data?.title || '', md: j?.data?.content || '' };
}

const DOCS = [
  ['生产管理·根据产品查询BOM', '/jdy/v2/pm/bom', '67fd31e275ab11f18fd1eff7c05e0e50'],
  ['基础资料·产品查询BOM', '/jdy/v2/bd/bom_query', '774dac6eb08211eeaee3b95748117ca8'],
  ['生产管理·材料分录联动查询', '/jdy/v2/pm/bom_material', '78535c9fb08211eeaee31bf4436932c6'],
  ['基础资料·BOM单详情', '/jdy/v2/bd/bom_detail', '9c2a2676712511eda0b34535ad178f07'],
];
const paramsOf = new Map();
for (const [label, path, id] of DOCS) {
  const { title, md } = await doc(id);
  const req = md.split(/#{2,6}\s*响应参数/)[0];
  const params = [...req.split('\n').filter((l) => l.trim().startsWith('|'))].slice(0, 26);
  console.log(`\n══════ ${label} | ${title} | ${path} ══════`);
  console.log(params.join('\n'));
  paramsOf.set(path, req);
}

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
console.log('\n\n===== 实测(不带参数 + 带常见参数) =====');
for (const [label, path] of DOCS.map((d) => [d[0], d[1]])) {
  for (const p of [{}, { page: '1', page_size: '5' }, { material_number: 'YJ-XH-001' }, { product_number: 'YJ-XH-001' }, { number: 'YJ-XH-001' }]) {
    const r = await kingdeeTryGet(cfg.kingdee, token, path, p);
    const tag = JSON.stringify(p);
    if (r.ok) {
      const d = r.data || {};
      const rows = d.rows || [];
      console.log(`✅ ${path} ${tag} → ${JSON.stringify(d).slice(0, 500)}`);
      break;
    }
    console.log(`❌ ${path} ${tag} → ${r.error}`);
  }
}
