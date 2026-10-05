#!/usr/bin/env node
// 增量同步(计划任务,每 5 分钟):只拉「已审核 + 近 windowDays 天修改/新增」的订单
// 依赖 sync-core.mjs;初始化/全量复核请用 init-sync.mjs
//
// 用法:
//   node sync.mjs --probe              验证凭证+全链路(不连数据库)
//   node sync.mjs --dry-run            拉取+映射但不写库
//   node sync.mjs                      正式增量同步
//   node sync.mjs --yes                跳过批量写入确认(超阈值时;计划任务可用)
//   node sync.mjs --refresh=BD_MATERIAL --yes
//                                      强制刷新指定类型(忽略库内指纹,全量重取详情再 upsert);
//                                      多个用逗号分隔,=* 或 =ALL 表示所有类型。
//                                      用于「金蝶新接了一个字段、要给存量行补拉一次」:
//                                      如商品·来料检验(见 sync-core.mjs 的 CF_INSPECTION_KEYS)。
//   node sync.mjs --config=D:\path\config.json
// 安全规范:写入前自动备份受影响单据前像(backup/*.jsonl);超阈值(默认200条)要求确认;
//           日志按日写 logs/sync-YYYY-MM-DD.log 并保留至少一年。
import { runCore } from './sync-core.mjs';

const args = process.argv.slice(2);
const argOf = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : undefined; };
const has = (name) => args.includes(`--${name}`);

try {
  await runCore({
    mode: 'incremental',
    configPath: argOf('config'),
    dryRun: has('dry-run'),
    probe: has('probe'),
    assumeYes: has('yes'),
    refresh: (argOf('refresh') || '').split(',').map((x) => x.trim()).filter(Boolean),
  });
} catch (e) {
  const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ✗ 同步失败: ${e.message}`;
  console.error(line);
  try {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(new URL(`./logs/sync-${new Date().toISOString().slice(0, 10)}.log`, import.meta.url), line + '\n', 'utf8');
  } catch { /* 忽略 */ }
  process.exit(1);
}
