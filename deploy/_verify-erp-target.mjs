// 转ERP 目标账套自检(只读,不写任何单据):判定 测试沙箱/真实账套 + 实测取 token
// 用法: node deploy/_verify-erp-target.mjs [--config=deploy/push/config.json]
// 判定口径与 KingdeePushService.assertPushTargetAllowed 一致:
//   outerInstanceId 非空 ⇒ 真实账套(须 application.yml kingdee.push.allowProd=true 才放行);
//   否则 sandboxInstanceId 非空 ⇒ 沙箱动态授权(每次取最新密钥,推荐);
//   两者皆空且有静态 appKey/appSecret ⇒ 沙箱静态密钥(appSecret 24h 轮换,随时失效报 1030002006)。
import { readFileSync } from 'node:fs';

const file = (process.argv.find((a) => a.startsWith('--config=')) || '--config=deploy/push/config.json').slice(9);
const k = JSON.parse(readFileSync(file, 'utf8')).kingdee;
const outer = (k.outerInstanceId || '').trim();
const sandbox = (k.sandboxInstanceId || '').trim();

const verdict = outer
  ? '🔴 真实账套(allowProd=false 时转ERP 会被守卫拒绝;推正式账前必须显式开开关)'
  : '✅ 测试沙箱';
console.log(`目标账套判定: ${verdict}`);
console.log(`  clientId=${k.clientId}  outerInstanceId=${outer || '(空)'}  sandboxInstanceId=${sandbox || '(空)'}`);

if (!outer && !sandbox && !k.appSecret) {
  console.log('⚠ 无任何可用凭证:动态实例id与静态密钥均为空');
  process.exit(1);
}

const { fetchAppToken, kingdeeGet } = await import('./kingdee-client.mjs');
const cfg = { ...k, outerInstanceId: outer || sandbox }; // 与后端 dynamicInstanceId() 同映射
const { token } = await fetchAppToken(cfg);
const mode = outer ? '真实账套·动态授权' : sandbox ? '沙箱·动态授权' : '沙箱·静态密钥(24h轮换,随时失效)';
console.log(`token 实测: OK(${mode}, domain=${cfg.domain})`);
const d = await kingdeeGet(cfg, token, '/jdy/v2/bd/measure_unit', { page: '1', page_size: '1' });
console.log(`只读GET 实测: OK(单位档案 count=${d.count})`);
