/*
 * _stage-first-insp-hunks.mjs — 只把「首件检验单完工回填」这一处改动放进暂存区(工作区文件不动)。
 *
 * 背景:同一棵工作树里还有另一个任务在改 `ButtonService.java`(组装成品检验单预铺检验项),
 * 而 AGENTS 要求「一个任务一个 commit」。`git add -p` 是交互式的、脚本里没法用;按 hunk 拼补丁
 * 走 `git apply --cached` 又容易撞上"corrupt patch"(子集 hunk 的行数/上下文要重新数)。
 * 这里改用**直接造 blob**的办法:
 *   ① `git show HEAD:<file>` 取基线正文;
 *   ② 在基线上只做本任务那一处**字面替换**(NEW 里的内容 === 工作区当前那一处);
 *   ③ `git hash-object -w` 写 blob → `git update-index --cacheinfo` 把它挂到索引上。
 * 索引 = 「基线 + 本任务改动」,另一个任务的改动一行都进不来,工作区文件也不被碰。
 * 同 `tools/archive/_stage-my-hunks.mjs` / `_stage-doc-only-mine.mjs` 的先例。
 *
 * 用法: node tools/archive/_stage-first-insp-hunks.mjs [--dry]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const FILE = 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
const dry = process.argv.includes('--dry')
const git = (args, input) => execFileSync('git', args, { cwd: 'D:/workspace/yinjia', input, encoding: 'utf8' })

/** 本任务在 ButtonService.firstInspGenerate 里的那一处替换(OLD 取自 HEAD 正文) */
const OLD = `        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("检验日期", today);
        // 生产日期(2026-10-16 第 J 段新加的抬头字段):纸张上单独一格,自动出单默认 = 今天,
        //   品质可在纸面改(图片上这一格本来是手填的;与单据日期/检验日期分开存)。
        head.put("生产日期", today);
        head.put("工单号", wo);
        if (xc != 0) head.put("工单行号", xc);
        head.put("报工单号", repNo);
        head.put("工序", r.get("工序"));
        head.put("批次号", batch);
`
/** 与工作区文件里那段逐字一致(见本任务 commit)。⚠ 工作区是 CRLF、仓库 blob 是 LF,这里统一成 LF,
 *  并保证结尾带换行 —— 少了它拼接点会和下一行粘成一行(staged 版出现过 `}        head.put("产品编码"…`)。 */
const NEW = fs.readFileSync('D:/workspace/yinjia/.tmp/_first-insp-new-block.txt', 'utf8')
  .replace(/\r\n/g, '\n').replace(/\n*$/, '\n')

const base = git(['show', 'HEAD:' + FILE])
if (!base.includes(OLD)) { console.error('HEAD 里找不到待替换的原文(基线变了?)'); process.exit(1) }
const mine = base.replace(OLD, NEW)
const tmp = path.join(os.tmpdir(), 'yj-button-service-mine.java')
fs.writeFileSync(tmp, mine)
console.log(`基线 ${base.split('\n').length} 行 → 本任务版 ${mine.split('\n').length} 行`)
if (dry) { console.log('(dry)未写索引'); process.exit(0) }
const blob = git(['hash-object', '-w', tmp]).trim()
git(['update-index', '--cacheinfo', `100644,${blob},${FILE}`])
console.log('已写入索引:' + blob)
