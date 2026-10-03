// _verify-kingdee-prod-auth.mjs — 只读探针:验证 deploy/push/config.json 的金蝶凭证能否对真实账套完成授权。
// 用法: node tools/archive/_verify-kingdee-prod-auth.mjs   (仓库根执行;node >= 18)
// 流程 = KingdeePushService 同款:outerInstanceId → push_app_authorize 拿轮换密钥 → kingdee_auth_token 换 token。
// 只取授权与 token,不调用任何业务写接口,不往账套写单据。token 只验长度,不打印明文。
import { readFileSync } from 'node:fs';
import { fetchAppToken } from '../../deploy/kingdee-client.mjs';

const cfgPath = new URL('../../deploy/push/config.json', import.meta.url);
const kingdee = JSON.parse(readFileSync(cfgPath, 'utf8')).kingdee;

if (!kingdee.outerInstanceId) {
  console.error('FAIL: 当前凭证无 outerInstanceId(静态密钥模式=沙箱),本探针只验真实账套动态授权链');
  process.exit(1);
}
console.log(`凭证: clientId=${kingdee.clientId} outerInstanceId=${kingdee.outerInstanceId} domain=${kingdee.domain}`);

try {
  const { token, domain } = await fetchAppToken(kingdee);
  console.log(`REAL-AUTH-OK: 授权+取token成功(token ${token.length} 字符, domain=${domain})`);
} catch (e) {
  console.error('REAL-AUTH-FAIL: ' + (e?.message || e));
  process.exit(1);
}
