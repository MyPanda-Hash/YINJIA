#!/usr/bin/env node
// 增量同步(计划任务,每 5 分钟):**库存现存量 + 金蝶单据/基础资料 + 在册核对**一个入口跑完
//   ① 库存同步(deploy/sync-stock.mjs 的 runStockSync):拉金蝶现存量覆盖 kucun,3~4 s;
//   ② 档案/订单增量(sync-core.mjs):只拉「已审核 + 近 windowDays 天修改/新增」的单据与档案。
//   ③ 金蝶在册核对(deploy/sync-presence.mjs):金蝶侧**已删除/已作废**、MES 仍停在「已审核」的单 ——
//      有下游痕迹的打标记拦截(状态=金蝶已删除/已作废 ⇒ 生单闸门自动拒),没痕迹的软删。
//      ⚠ 为什么必须有这一步:增量只拉 bill_status=C,金蝶删单/作废后该单从列表消失,
//      而同步从不删 MES 单据 ⇒ 那张单在 MES 里能一直继续分批送料/生单,且不报错(2026-11-16 用户口径)。
// 顺序说明(2026-11-10 用户口径「库存同步能不能和商品同步脚本写在一起」):
//   库存放最前面 —— 它只 3~4 s,不会被档案全量/长事务拖住;档案那步失败也不影响库存已落库。
//   在册核对放最后 —— 它依赖 ② 已把新审核单写进来,失败也不影响 ①②。
// 初始化/全量复核请用 init-sync.mjs(**不含库存**:那是一次性重建,不该顺手改库存)。
//
// 用法:
//   node sync.mjs --probe              验证凭证+全链路(不连数据库;不跑库存)
//   node sync.mjs --dry-run            拉取+映射+算库存差异,但不写库
//   node sync.mjs                      正式:先库存、再档案/订单、最后在册核对
//   node sync.mjs --no-stock           只同步档案/订单(库存那步跳过)
//   node sync.mjs --no-presence        跳过在册核对(仅排查时用)
//   node sync.mjs --presence-full      在册核对忽略"计数未变"的快速跳过,强制全量对差
//   node sync.mjs --yes                跳过批量写入确认(超阈值时;计划任务可用)
//   node sync.mjs --refresh=BD_MATERIAL --yes
//                                      强制刷新指定类型(忽略库内指纹,全量重取详情再 upsert);
//                                      多个用逗号分隔,=* 或 =ALL 表示所有类型。
//                                      用于「金蝶新接了一个字段、要给存量行补拉一次」:
//                                      如商品·来料检验(见 sync-core.mjs 的 CF_INSPECTION_KEYS)。
//   node sync.mjs --config=D:\path\config.json
// 安全规范:写入前自动备份受影响单据前像(backup/*.jsonl);超阈值(默认200条)要求确认;
//           日志按日写 logs/sync-YYYY-MM-DD.log 与 logs/stock-sync-YYYY-MM-DD.log,均保留至少一年。
//           库存侧另有自己的闸门(0 行/行数骤降/锁)与前像 backup/stock-*.jsonl。
import { runCore } from './sync-core.mjs';
// 2026-11-10:「库存同步」并进同一个入口 —— 抽成可复用函数(本文件的 import 不会触发它自跑一次,
// 判据见 sync-stock.mjs 底部的 invokedDirectly)。
import { runStockSync } from './sync-stock.mjs';
// 2026-11-16「金蝶在册核对」:金蝶删了/作废了已审核单,MES 不能还当"已审核"继续生单
// (增量只拉 bill_status=C ⇒ 这类单会从列表里消失;口径与阈值见 sync-presence.mjs 头注)。
import { runPresenceCheck } from './sync-presence.mjs';

const args = process.argv.slice(2);
const argOf = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : undefined; };
const has = (name) => args.includes(`--${name}`);

const dryRun = has('dry-run');
const probe = has('probe');

// ① 库存同步(失败不阻断档案同步,但整轮以非 0 退出 ⇒ 计划任务历史里能看见)
let stockFailed = null;
if (!probe && !has('no-stock')) {
  try {
    const r = await runStockSync({ configPath: argOf('config'), dryRun, source: 'sync.mjs(合并)' });
    if (r?.ok === false) stockFailed = r.skipped || '未执行';
  } catch (e) {
    stockFailed = e.message;
    const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ✗ 库存同步失败(档案同步继续): ${e.message}`;
    console.error(line);
    try {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(new URL(`./logs/sync-${new Date().toISOString().slice(0, 10)}.log`, import.meta.url), line + '\n', 'utf8');
    } catch { /* 忽略 */ }
  }
}

// ② 档案/订单增量
try {
  await runCore({
    mode: 'incremental',
    configPath: argOf('config'),
    dryRun,
    probe,
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

// ③ 金蝶在册核对(2026-11-16):金蝶侧已删除/已作废、而 MES 仍停在「已审核」的单 →
//    有下游痕迹的标记拦截(状态=金蝶已删除/已作废,生单闸门自动拒),没有痕迹的软删。
//    失败不影响本轮同步结果(与库存那步同口径)。--no-presence 可跳过。
if (!probe && !has('no-presence')) {
  try {
    await runPresenceCheck({
      configPath: argOf('config'),
      dryRun,
      full: has('presence-full'),
      log: (m) => console.log(`[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${m}`),
    });
  } catch (e) {
    const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ⚠ 在册核对失败(同步结果不受影响): ${e.message}`;
    console.error(line);
    try {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(new URL(`./logs/sync-${new Date().toISOString().slice(0, 10)}.log`, import.meta.url), line + '\n', 'utf8');
    } catch { /* 忽略 */ }
  }
}

if (stockFailed) {
  console.error(`[库存] 本轮未完成:${stockFailed}`);
  process.exitCode = 1;
}
