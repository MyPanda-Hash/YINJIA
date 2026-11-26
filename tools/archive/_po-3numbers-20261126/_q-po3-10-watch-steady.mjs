// 只读:复跑「入库单触发扫描」的一轮(不推进水位线),确认稳态窗口回到 20 分钟级
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken } from '../../../deploy/kingdee-client.mjs';
import { inboundWatchedPoNos } from '../../../deploy/inbound-watch.mjs';

const DEPLOY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const cfg = JSON.parse(readFileSync(join(DEPLOY, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const state = JSON.parse(readFileSync(join(DEPLOY, 'state.json'), 'utf8'));
console.log('水位线 inboundWatchUntil =', state.inboundWatchUntil ? new Date(state.inboundWatchUntil).toISOString() : '(无)');

const tk = await fetchAppToken(cfg.kingdee);
cfg.kingdee.domain = tk.domain || cfg.kingdee.domain;
const pos = await inboundWatchedPoNos({
  kingdeeCfg: cfg.kingdee, token: tk.token, state, saveState: undefined,
  log: (m) => console.log(m),
});
console.log('本轮触发订单:', pos.length, pos.slice(0, 10));
