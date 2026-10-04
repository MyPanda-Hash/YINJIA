// 探针:打印「根据产品查询BOM」(/jdy/v2/pm/bom)与相邻两个 BOM 接口的完整响应字段
import { createHmac } from 'node:crypto';
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
  return j?.data?.content || '';
}
const DOCS = [
  ['根据产品查询BOM(生产管理 /jdy/v2/pm/bom)', '67fd31e275ab11f18fd1eff7c05e0e50'],
  ['产品查询BOM(基础资料 /jdy/v2/bd/bom_query)', '774dac6eb08211eeaee3b95748117ca8'],
];
for (const [label, id] of DOCS) {
  const md = await doc(id);
  const resp = md.split(/#{2,6}\s*响应参数/)[1] || '';
  const body = resp.split(/#{2,6}\s*(返回码|请求示例|响应示例)/)[0] || resp;
  console.log(`\n══════════ ${label} ══════════`);
  console.log('【请求地址/方式】');
  console.log((md.split(/#{2,6}\s*请求参数/)[0] || '').split('\n').filter((l) => l.trim().startsWith('-')).join('\n'));
  console.log('\n【响应字段】');
  console.log(body.split('\n').filter((l) => l.trim()).slice(0, 120).join('\n'));
  const sample = md.split(/#{2,6}\s*响应示例/)[1] || '';
  if (sample) { console.log('\n【响应示例(前 40 行)】'); console.log(sample.split('\n').slice(0, 40).join('\n')); }
}
