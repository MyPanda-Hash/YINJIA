// 探针:转ERP 目标(测试沙箱,deploy/push/config.json 静态 appKey/appSecret)的 app-token 是否可用
// 只取 token + 试拉一张生产领料单列表(只读,不写任何单据)。
// 用法: node tools/archive/_probe-kingdee-sandbox-token.mjs
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));
console.log('目标账套判定:', cfg.kingdee.outerInstanceId ? '真实账套(动态授权)' : '测试沙箱(静态密钥)');
console.log('clientId:', String(cfg.kingdee.clientId).slice(0, 6) + '…', 'domain:', cfg.kingdee.domain);
try {
  const { token } = await fetchAppToken(cfg.kingdee);
  console.log('✅ app-token 获取成功,长度', token.length);
  for (const p of ['/jdy/v2/scm/inv_pick', '/jdy/v2/bd/measure_unit', '/jdy/v2/bd/material']) {
    const r = await kingdeeTryGet(cfg.kingdee, token, p, { page: '1', page_size: '2' });
    console.log(r.ok ? `✅ ${p} → count=${r.data?.count}` : `❌ ${p} → ${r.error}`);
    await new Promise((r2) => setTimeout(r2, 150));
  }
} catch (e) {
  console.log('❌ app-token 获取失败:', e.message);
  process.exit(1);
}
