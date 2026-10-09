#!/usr/bin/env node
/**
 * _hash-drift.mjs — 只读对账:清单里每个脚本的**当前字节哈希** vs yj_schema_log 记录的哈希
 *
 * 回答:如果现在跑 DbSync,哪些脚本会被判为「新增/变更」而**重跑**?
 *   [新增] = 台账无记录(会被执行)
 *   [变更] = 字节与上次执行时不同(会被重跑 —— 这是最危险的一类,历史脚本重跑撞 schema 演进)
 *   一致   = 会跳过
 *
 * 哈希口径必须与 DbSync.sha256 完全一致:Files.readAllBytes → SHA-256 → 小写 hex(不做换行归一化)。
 *
 * 用法(tools 目录下,两个账套各跑一次):
 *   node archive/_registry-audit-20261008/_hash-drift.mjs HSDZ_MES
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DB = process.argv[2] || 'HSDZ_MES';
const tools = process.cwd();

const scripts = readFileSync(join(tools, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

// 用 JDBC 查台账(java 单文件模式,复用仓库既有 lib/mssql-jdbc.jar)
const q = `SELECT RTRIM(script_name) + '\\t' + RTRIM(content_hash) AS r FROM yj_schema_log`;
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java.exe') : 'java';
const out = execFileSync(java, [
  '-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar',
  'archive/_registry-audit-20261008/HashQuery.java', DB,
], { cwd: tools, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const logged = new Map();
for (const line of out.split(/\r?\n/)) {
  const t = line.indexOf('\t');
  if (t > 0) logged.set(line.slice(0, t).trim(), line.slice(t + 1).trim());
}

let same = 0;
const added = [], changed = [];
for (const s of scripts) {
  let hash;
  try {
    hash = createHash('sha256').update(readFileSync(join(tools, s))).digest('hex');
  } catch {
    added.push(`[缺文件] ${s}`);
    continue;
  }
  const l = logged.get(s);
  if (l === undefined) added.push(s);
  else if (l !== hash) changed.push(s);
  else same++;
}

console.log(`=== ${DB} ===`);
console.log(`清单 ${scripts.length} 条;一致(跳过) ${same};台账无记录(将新增执行) ${added.length};字节变更(将重跑) ${changed.length}`);
console.log(`\n【将新增执行】`);
added.forEach((s) => console.log('    ' + s));
console.log(`\n【将重跑(字节已变)】`);
changed.forEach((s) => console.log('    ' + s));
