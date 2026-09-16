// deploy/push/_get-token.mjs — 获取沙箱 app-token(供 Java KingdeePushService 子进程调用)
// 输出:纯 token 字符串(stdout),失败输出错误(stderr)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const { fetchAppToken } = await import(pathToFileURL(join(HERE, '..', 'kingdee-client.mjs')).href);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
try {
  const { token } = await fetchAppToken(cfg.kingdee);
  console.log(token);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
