// 只读:把 CGRK-20261125-03863 的明细行原始字段全打出来,找 865 到底落在哪个字段
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg);
cfg.domain = tk.domain || cfg.domain;
const no = process.argv[2] || 'CGRK-20261125-03863';
const list = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound', { bill_no: no, page: '1', page_size: '5' });
const head = (list.rows || [])[0];
console.log('head:', JSON.stringify(head, null, 1).slice(0, 2500));
const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound_detail', { id: String(head.id) });
for (const e of d.material_entity || []) {
  console.log('\n=== line seq=' + e.seq);
  const keys = Object.keys(e).filter((k) => {
    const v = e[k];
    return v !== null && v !== '' && v !== 0 && !(typeof v === 'string' && /^[0-9a-f]{32}$/.test(v));
  });
  for (const k of keys) console.log(`  ${k} = ${JSON.stringify(e[k])}`);
}
