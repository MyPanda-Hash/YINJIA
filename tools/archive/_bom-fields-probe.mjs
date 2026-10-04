// 探针:BOM 子料分录字段全集 + 生产任务单/委外单是否存在工艺路线/工序字段
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
const rowsOf = (md, section) => {
  const part = md.split(/\*\*MaterialEntity\*\*|\*\*Row\*\*/)[1] || md;
  return part.split('\n').filter((l) => l.trim().startsWith('|')).slice(0, 60);
};

// ① BOM 子料分录字段全集
{
  const { title, md } = await doc('9c2c4958712511eda0b361e90d734914');
  const after = md.split('**MaterialEntity**')[1] || '';
  console.log(`===== ${title} · MaterialEntity(子料分录)字段 =====`);
  console.log(after.split('\n').filter((l) => l.trim().startsWith('|')).slice(0, 60).join('\n'));
}

// ② 生产任务单(列表/详情)是否含工艺路线/工序
for (const [label, id] of [['生产任务单列表', '9d9acd15712511eda0b34534b54d70cb'], ['生产任务单详情', '9d9bde86712511eda0b31b0a0f74345b'], ['委外加工单详情', '575ff859308b11f09806f98400cc9e6a']]) {
  const { title, md } = await doc(id);
  const path = (/请求地址[:：]\s*(\S+)/.exec(md) || [])[1] || '';
  const keys = [...new Set([...md.matchAll(/^\|\s*([a-z_][a-z0-9_]*)\s*\|/gim)].map((m) => m[1]))];
  const hit = keys.filter((k) => /process|route|procedure|operat|craft|technic|work_?center|dept/i.test(k));
  console.log(`\n===== ${title} | ${path} | 字段 ${keys.length} 个 =====`);
  console.log('与工序/路线/车间相关的键:', hit.join(', ') || '(无)');
  console.log('全部键:', keys.join(', '));
}
