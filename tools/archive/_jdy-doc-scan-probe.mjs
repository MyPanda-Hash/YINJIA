// 探针:拉取官方文档「生产任务单/委外加工单/BOM」,检索是否含 工序/工艺路线 字段
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
  return { title: j?.data?.title || '', md: j?.data?.content || '' };
}
const DOCS = [
  ['生产任务单列表', '9d9acd15712511eda0b34534b54d70cb'],
  ['委外加工单列表', '9db7a3f2712511eda0b37520a0aa1010'],
  ['BOM单列表', '9c2c4958712511eda0b361e90d734914'],
];
for (const [label, id] of DOCS) {
  const { title, md } = await doc(id);
  const path = (/请求地址[:：]\s*(\S+)/.exec(md) || [])[1] || '';
  const hitLines = md.split('\n').filter((l) => /工序|工艺|路线|车间|work_?center|process|route|procedure/i.test(l));
  console.log(`\n===== ${label} | ${title} | ${path} | md ${md.length} 字 =====`);
  console.log(hitLines.slice(0, 25).join('\n') || '(无 工序/工艺/路线 相关字段)');
}
