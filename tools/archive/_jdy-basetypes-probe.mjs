// 探针:读官方《基础资料及单据类型》文档,看工艺路线是否在册
import { createHmac } from 'node:crypto';
const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
for (const [label, id] of [['基础资料及单据类型', 'dd7ee492712611eda0b375f5553347df'], ['旗舰版管理', 'b1ced1824bbc11eeaf17116f87ea53d9'], ['旗舰版常见问题', '36f615d2fad111eeaee3a7bb6f3d72a1']]) {
  const r = await fetch('https://open.jdy.com/api/document_info/content', { method: 'POST', headers: postHeaders(), body: JSON.stringify({ id }) });
  const j = await r.json();
  const md = j?.data?.content || '';
  console.log(`\n========== ${label}(md ${md.length} 字) ==========`);
  console.log(md.slice(0, 2500));
}
