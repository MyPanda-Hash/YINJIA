// 运行安全规范工具(所有同步/维护脚本共用)
//   1) 批量操作提示     : 计划写入量超过阈值时,交互环境必须人工确认;计划任务环境记告警后继续
//   2) 写入前备份       : 把将被影响的单据"前像"(头+行)快照为 JSONL,可完整回滚;删除操作同样先备份
//   3) 日志按日轮转     : logs/sync-YYYY-MM-DD.log,保留期默认 365 天(规范:至少一年)
//   4) 备份保留期       : backup/*.jsonl,默认 365 天自动清理
// 规范同样适用于"向金蝶写入"的脚本:任何批量导入/删除前先备份+统计+提示。
import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

/** 清理目录中超过保留期的文件 */
function pruneDir(dir, retentionDays) {
  const cutoff = Date.now() - retentionDays * 86400000;
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      try { if (statSync(p).mtimeMs < cutoff) unlinkSync(p); } catch { /* 忽略单文件异常 */ }
    }
  } catch { /* 目录不存在等忽略 */ }
}

/** 日志器:控制台 + logs/<prefix>-YYYY-MM-DD.log(按日轮转,超保留期自动清理) */
export function makeLogger({ baseDir, retentionDays = 365, prefix = 'sync' }) {
  const dir = join(baseDir, 'logs');
  mkdirSync(dir, { recursive: true });
  pruneDir(dir, retentionDays);
  const file = join(dir, `${prefix}-${new Date().toISOString().slice(0, 10)}.log`);
  return {
    logPath: file,
    log(msg) {
      const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}`;
      console.log(line);
      try { appendFileSync(file, line + '\n', 'utf8'); } catch { /* 日志失败不影响业务 */ }
    },
  };
}

/**
 * 批量操作提示:planned 超过 threshold 时要求确认。
 * assumeYes(--yes) 跳过;
 * 只有在 stdin 与 stdout 都是交互终端时才真的提问(且 60s 超时兜底)——
 * 计划任务/隐藏窗口环境下 stdin 可能"看起来可交互",直接提问会导致进程永久挂起(实测踩坑)。
 */
export async function confirmBatch({ log, label, planned, threshold, assumeYes = false, timeoutMs = 5000 }) {
  if (planned <= threshold) return true;
  const msg = `${label} 本次将批量写入/删除 ${planned} 条(超过阈值 ${threshold})`;
  if (assumeYes) { log(`⚠ ${msg} —— 已显式 --yes,继续执行`); return true; }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    log(`⚠ ${msg} —— 非交互环境(计划任务/隐藏窗口),按规范记录告警后继续(可用 --yes 消除此告警)`);
    return true;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let ans = '';
  try {
    ans = String(await Promise.race([
      rl.question(`${msg}\n确认继续? (y/N) `),
      new Promise((r) => setTimeout(() => r('__timeout__'), timeoutMs)),
    ])).trim().toLowerCase();
  } catch {
    ans = '__timeout__'; // stdin 关闭等异常同样按超时处理,绝不挂起
  } finally {
    rl.close();
  }
  if (ans === '__timeout__') {
    log(`⚠ ${msg} —— 等待确认超时 ${Math.round(timeoutMs / 1000)}s,按规范记录告警后继续`);
    return true;
  }
  if (ans === 'y' || ans === 'yes') { log(`${msg} —— 已人工确认,继续`); return true; }
  log(`${msg} —— 操作员未确认,已中止(未写入任何数据)`);
  return false;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 写入前备份:把将被影响的单据前像(头表+行表)快照为 JSONL。
 * docNos=null  → 全量快照(初始化场景:头表取全部已同步行,行表全量)
 * docNos=[...] → 按单据编号精确快照(增量场景:只备份本轮将触碰的单)
 * keyCol       → 精确快照的定位列(默认 单据编号;基础资料档案传 外部数据ID)
 * lineTable=null → 单表目标(基础资料档案):跳过行表快照
 * 返回 { path, heads, lines, bytes }
 */
export async function backupBeforeWrite({ mssql, pool, baseDir, panel, headTable, lineTable, docNos, keyCol = '单据编号', retentionDays = 365, log }) {
  const dir = join(baseDir, 'backup');
  mkdirSync(dir, { recursive: true });
  pruneDir(dir, retentionDays);
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const path = join(dir, `${panel}-${stamp}.jsonl`);
  let body = '';
  let heads = 0, lines = 0;

  const collect = async (sql, params, kind) => {
    const req = new mssql.Request(pool);
    (params || []).forEach((v, i) => req.input(`b${i}`, mssql.NVarChar(200), v));
    const rs = await req.query(sql);
    for (const row of rs.recordset) {
      body += JSON.stringify({ t: kind, ...row }) + '\n';
      kind === 'head' ? heads++ : lines++;
    }
  };

  if (docNos == null) {
    await collect(`SELECT * FROM ${headTable} WHERE 外部数据ID IS NOT NULL`, null, 'head');
    if (lineTable) await collect(`SELECT * FROM ${lineTable}`, null, 'line');
  } else if (docNos.length) {
    for (const c of chunk(docNos, 300)) {
      const inClause = c.map((_, i) => `@b${i}`).join(',');
      await collect(`SELECT * FROM ${headTable} WHERE ${keyCol} IN (${inClause})`, c, 'head');
      if (lineTable) await collect(`SELECT * FROM ${lineTable} WHERE ${keyCol} IN (${inClause})`, c, 'line');
    }
  }
  writeFileSync(path, body, 'utf8');
  const bytes = Buffer.byteLength(body, 'utf8');
  if (log) log(`备份完成:${path.replace(baseDir, '.')}(头 ${heads} / 行 ${lines},${(bytes / 1024).toFixed(1)} KB)`);
  return { path, heads, lines, bytes };
}
