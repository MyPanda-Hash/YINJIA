#!/usr/bin/env node
// 初始化/全量复核(手动运行,或每月定期跑一次对账):
//   首次部署   —— 全量拉取已审核订单(无时间窗),数量大时耗时约 1分钟/千张
//   定期复核   —— 弥补增量时间窗之外的极小概率遗漏(指纹跳过使复核通常只花列表时间)
// 依赖 sync-core.mjs;日常增量请用 sync.mjs(计划任务)
// 状态过滤:默认仅已审核(C),如需调整改 config.sync.initBillStatus
//
// 用法:
//   node init-sync.mjs                全量初始化/复核(状态范围:config.sync.initBillStatus,默认已审核C)
//   node init-sync.mjs --dry-run      只看会写什么,不落库
//   node init-sync.mjs --yes          跳过批量写入确认(超阈值时;确认无人值守场景)
//   node init-sync.mjs --config=D:\path\config.json
// 安全规范:写入前自动备份全部已同步单据前像(backup/*.jsonl);超阈值(默认200条)要求人工确认;
//           日志按日写 logs/sync-YYYY-MM-DD.log 并保留至少一年。
import { runCore } from './sync-core.mjs';

const args = process.argv.slice(2);
const argOf = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : undefined; };
const has = (name) => args.includes(`--${name}`);

try {
  await runCore({
    mode: 'init',
    configPath: argOf('config'),
    dryRun: has('dry-run'),
    assumeYes: has('yes'),
  });
} catch (e) {
  const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ✗ 初始化失败: ${e.message}`;
  console.error(line);
  try {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(new URL(`./logs/sync-${new Date().toISOString().slice(0, 10)}.log`, import.meta.url), line + '\n', 'utf8');
  } catch { /* 忽略 */ }
  process.exit(1);
}
