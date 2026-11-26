import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';
const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg); cfg.domain = tk.domain || cfg.domain;
const paths = ['/jdy/v2/scm/pur_return','/jdy/v2/scm/pur_inbound_return','/jdy/v2/scm/pur_inbound_rt','/jdy/v2/scm/pur_order_return','/jdy/v2/scm/pur_rt','/jdy/v2/scm/purchase_return'];
for (const p of paths) {
  const r = await kingdeeTryGet(cfg, tk.token, p, { page: '1', page_size: '1' });
  console.log(`${p} → ${r.ok ? 'OK count=' + r.data.count : 'NG ' + r.error}`);
}
