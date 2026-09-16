// 生成《面板字段对照》文档 v2:详情字段全集 + 列表文档说明回填
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
async function fetchDoc(id) {
  const r = await fetch('https://open.jdy.com/api/document_info/content', { method: 'POST', headers: postHeaders(), body: JSON.stringify({ id }) });
  const j = await r.json();
  return { title: j.data?.title || '', md: j.data?.content || '' };
}
function parseResp(md) {
  const path = (/请求地址[:：]\s*(\S+)/.exec(md) || [])[1] || '';
  const respPart = md.split(/#{2,6}\s*响应参数/)[1] || '';
  const rows = [];
  let cur = '';
  for (const raw of respPart.split('\n')) {
    const line = raw.trim();
    const h = /^(#{2,6})\s*(.+)$/.exec(line);
    if (h) { cur = h[2].trim(); continue; }
    const b = /^\*\*(.+?)\*\*:?\s*$/.exec(line); // **Data** / **MaterialEntity** 等子结构
    if (b) { cur = b[1].trim(); continue; }
    if (!line.startsWith('|')) continue;
    let cells = line.split('|').map((c) => c.trim());
    if (line.startsWith('|')) cells = cells.slice(1);          // 去首空
    if (line.endsWith('|')) cells = cells.slice(0, -1);        // 去尾空(仅当存在尾竖线)
    if (cells.length < 2) continue;
    if (/^-+:?$|^:?-+$/.test(cells[0].replace(/\s/g, ''))) continue;
    if (/^(参数名称|参数|字段|字段名)$/.test(cells[0])) continue;
    rows.push({ section: cur, name: cells[0], type: cells[1] || '', desc: cells[2] || '' });
  }
  return { path, rows };
}
const WRAPPER = new Set(['errcode', 'description', 'data', 'msg', 'code']);

const fmt = (label, path, fields) => {
  const bySec = new Map();
  for (const f of fields) {
    if (!bySec.has(f.section)) bySec.set(f.section, []);
    bySec.get(f.section).push(f);
  }
  let out = `\n## ${label}\n\n> 接口:${path}\n`;
  for (const [sec, list] of bySec) {
    out += `\n### ${sec}\n\n| 字段 | 类型 | 说明 |\n|---|---|---|\n`;
    const seen = new Set();
    for (const f of list) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      out += `| ${f.name} | ${f.type} | ${(f.desc || '-').replace(/\|/g, '\\|')} |\n`;
    }
  }
  return out;
};

// [标签, 详情文档id(字段全集), 列表文档id(说明回填)]
const GROUPS = [
  { title: '一、基础资料(在用面板)', panels: [
    ['客户', '9c3e23b1712511eda0b389b6992086dd', '9c3d3950712511eda0b3f9343e4297f7'],
    ['供应商', '9ce64add712511eda0b35b65ecdbbb68', '9ce7f88f712511eda0b313592b350ebd'],
    ['商品(存货)', '9c75ae89712511eda0b36d011d99d638', '9c77d16b712511eda0b3b7b3cc033db5'],
    ['职员', '9c4f61ca712511eda0b3bfa16e8b0669', '9c583b6c712511eda0b3cdfb303d26af'],
    ['部门', '9c4b4316712511eda0b3f7c18dcbd231', '9c4cf0c8712511eda0b3ddc61ac19fc6'],
    ['仓库', '9cd5a905712511eda0b3096854ab62f0', '9cd7a4d7712511eda0b30feda7b225ca'],
    ['计量单位', '9c9878db712511eda0b3ada9ffcd9a82', '9c97b58a712511eda0b301369440b540'],
    ['结算方式', null, '9cb8f93b712511eda0b33dd9bb88427f'],
    ['客户分类', null, '9c48ab04712511eda0b39f6adb9b9dc0'],
    ['供应商分类', null, '9cf1bc92712511eda0b35f062038767f'],
    ['商品分类', '9c8bcea5712511eda0b3292cba8a6d6c', '9c8ae444712511eda0b37d0f701993b9'],
    ['币别', '9c38092d712511eda0b3a5be9c0bc8a9', '9c3040fc712511eda0b335487d560a84'],
  ] },
  { title: '二、销售订单(已同步 MES:SO_ORDER)', panels: [
    ['销售订单(表头+商品分录)', '9e6e7132712511eda0b3b9a1d236ec55', '9e694111712511eda0b3c7524f26ede0'],
  ] },
  { title: '三、采购订单(已同步 MES:PU_ORDER)', panels: [
    ['采购订单(表头+商品分录)', '9e50aff0712511eda0b35bde18fd6367', '9e4fc58f712511eda0b3a33cf6007dda'],
  ] },
];

let doc = `# 金蝶云·星辰 面板字段对照(官方文档提取)\n\n> 生成时间:${new Date().toISOString().slice(0, 19)} | 来源:open.jdy.com 官方接口文档(响应参数)\n> 覆盖:账套实际在用的基础资料面板 + 销售订单 + 采购订单\n> 说明:字段全集取自《详情》接口;说明列优先取《详情》文档,缺失时以《列表》文档回填\n`;
for (const g of GROUPS) {
  doc += `\n---\n\n# ${g.title}\n`;
  for (const [label, detailId, listId] of g.panels) {
    const listDoc = listId ? parseResp((await fetchDoc(listId)).md) : { rows: [] };
    const descMap = new Map(listDoc.rows.filter((r) => r.desc && r.desc !== r.type).map((r) => [r.name, r.desc]));
    const mainId = detailId || listId;
    const { title, md } = await fetchDoc(mainId);
    const { path, rows } = parseResp(md);
    const fields = rows
      .filter((r) => !WRAPPER.has(r.name))
      .map((r) => ({ ...r, desc: (r.desc && r.desc !== r.type) ? r.desc : (descMap.get(r.name) || '') }));
    const filled = fields.filter((f) => f.desc).length;
    console.log(`${label.padEnd(16)} ${title} → ${path} (${fields.length} 字段,${filled} 有说明)`);
    doc += fmt(label, path, fields);
  }
}
writeFileSync(new URL('./面板字段对照.md', import.meta.url), doc, 'utf8');
console.log(`\n已生成 面板字段对照.md(${Math.round(doc.length / 1024)} KB)`);
