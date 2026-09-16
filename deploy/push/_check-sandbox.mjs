// _check-sandbox.mjs — 查推送沙箱的基础数据
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const { fetchAppToken, kingdeeGet } = await import(pathToFileURL(join(HERE, '..', 'kingdee-client.mjs')).href);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
console.log('沙箱连通 OK (clientId=' + cfg.kingdee.clientId + ')');
for (const [label, path] of [['供应商','/jdy/v2/bd/supplier'],['客户','/jdy/v2/bd/customer'],['商品','/jdy/v2/bd/material'],['仓库','/jdy/v2/bd/store']]) {
  try {
    const r = await kingdeeGet(cfg.kingdee, token, path, { page: '1', page_size: '5' });
    console.log(`\n[${label}] 共 ${r.count} 条:`);
    (r.rows || []).forEach(x => console.log(`  ${x.number} | ${x.name}`));
  } catch (e) { console.log(`\n[${label}] 失败: ${e.message.slice(0, 80)}`); }
}
