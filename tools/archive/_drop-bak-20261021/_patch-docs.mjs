/* 本次任务文档补写(_drop-bak-20261021):逐字替换 + 追加维护记录行,保留原文件行尾。
 * 用法:node tools/archive/_drop-bak-20261021/_patch-docs.mjs
 */
import fs from 'node:fs'

const ROOT = 'D:/workspace/yinjia/'

/* ── ① 数据库表清单.md:第 10 组口径补「2026-10-21 再次清零」+ 追加 v3.53 维护记录 ── */
{
  const p = ROOT + 'docs/development/数据库表清单.md'
  let s = fs.readFileSync(p, 'utf8')

  const oldCell = '**已清零（2026-09-29）**'
  const newCell = '**已清零（2026-09-29；2026-10-21 再次清零）**'
  if (!s.includes(oldCell)) throw new Error('锚点①未命中:' + oldCell)
  s = s.replace(oldCell, newCell)

  const oldTail = '禁止引用；体检 10 项棘轮基线已收到 0（再出现即 FAIL） |'
  const newTail = '禁止引用；体检 10 项棘轮基线已收到 0（再出现即 FAIL）。'
    + '2026-10-18/21 两批任务留下的 `_bak_pc0000_*`(5) + `_bak_qcdraft_*`(7) 已按用户口径 DROP，'
    + '见 `tools/migrate-drop-bak-snapshots-20261021.sql`（维护记录 v3.53） |'
  if (!s.includes(oldTail)) throw new Error('锚点②未命中:' + oldTail)
  s = s.replace(oldTail, newTail)

  const row = '| v3.53 | 2026-10-21 | **清理 12 张 `_bak_*` 回滚快照表（PC0000 归一 5 张 / 检验单空壳清理 7 张）** —— '
    + '用户口径「这些表是之前危险删除操作的备份文件……如果是这样的话当前可以删除掉这些表了」。'
    + '① **删前取证（两账套）**：① PC0000 归一已生效（`kucun`/`inh`/`outh` 残留 **0**）；'
    + '② 快照里的草稿单在业务表命中 **0**（`_bak_qcdraft_proc_head` 15 张 / `fst_head` 63 张确实已删）；'
    + '③ 全仓 grep（java/vue/js/sql）对这 12 张表名 **0 引用**、`db-inuse-tables.txt` **未登记**⇒ 纯快照、可弃。'
    + '② **删的 12 张**（行数实测）：`_bak_pc0000_20261018_kucun`(1080)/`_inh`(1076)/`_outh`(4668) = 归一前 PC0000 原行；'
    + '`_bak_pc0000_baseline`(1) = 归一前基线（行数 1473 / 余量 -347842.826）；`_bak_pc0000_merge`(0) = 合并中间表；'
    + '`_bak_qcdraft_proc_head`(15)/`fst_head`(63)/`fst_status`(9) + 4 张 0 行快照（命中的空壳单本来就没有明细/审批行）。'
    + '脚本 `migrate-drop-bak-snapshots-20261021.sql`（已登记 `db-migrations.txt`）：**按家族通配**删 '
    + '`_bak_pc0000_%` / `_bak_qcdraft_%`（快照表名带 `GETDATE()` 日期后缀，整链重放会生成新日期，写死名字会漏）；'
    + '三道闸门（PC0000 残留=0 / 快照草稿单未回流 / 名单外无其它 `*bak*`·`RENAME_`·`tmp_` 表）+ 单事务，任一不过只报错不删。'
    + '③ **结果**：两账套 `DbSync run` 均 `[OK]`、复跑 `[跳过]`（幂等）；表总数 **255 → 243**（两账套），'
    + '业务行数一分未动（正式 `kucun` 1480 / `inh` 2529 / `outh` 3318 / 制程单头 434 / 首件单头 425；测试 42/45/2/40/30）；'
    + '`DbNormAudit` 第 **10 项 FAIL(12) → PASS(0)** —— 正式库 FAIL **3 → 2**（余 09 缺 en 译名 221、12 清单与文件差 3 处，均存量）、'
    + '测试库 FAIL 7 全为存量（01/02/03/05/09/12/13，与本次无关）。'
    + '④ 🔴 **踩坑（首跑就中）**：闸门曾写成 `IF 有问题 RAISERROR(...)` 后继续往下走 —— '
    + '**`RAISERROR` 不中止批次**（只给客户端发错误消息，后续语句照跑），实测闸门③ 报了错、DROP 仍执行；'
    + '本次目标恰好就是要删的 12 张（闸门①② 均通过）故无损失，但闸门等于没有。'
    + '已改为**把删除整段放进 `ELSE`**（闸门通过才进入，不依赖"报错会不会停下"），'
    + '并修正 `IF @extra IS NOT NULL`（空串也 `IS NOT NULL`）为 `<> N\'\'`。'
    + '**规矩**：破坏性语句必须由 `IF/ELSE` 或事务控制，不能靠 `RAISERROR` 停机。'
    + '⑤ **回滚**：不可回滚（数据即快照本身）；要重建同口径数据只能从数据库 `.bak` 还原 —— 这正是先跑闸门①② 再 DROP 的原因。⚠ 本行手写（理由同 v3.31：生成器会覆盖维护记录） |'

  if (!s.endsWith('\r\n')) s += '\r\n'
  s += row + '\r\n'
  fs.writeFileSync(p, s, 'utf8')
  console.log('[OK] 数据库表清单.md:已补第 10 组口径 + v3.53 行')
}

/* ── ② 检验单清理 README:快照已 DROP,回滚段改成"已失效 + 指向新脚本" ── */
{
  const p = ROOT + 'tools/archive/_qc-insp-purge-20261021/README.md'
  let s = fs.readFileSync(p, 'utf8')

  const oldHdr = '## 六、回滚'
  const newHdr = '## 六、回滚（⚠ 2026-10-21 起快照已按用户口径删除，本段仅作留档）\n\n'
    + '> 用户 2026-10-21 确认「这些表是之前危险删除操作的备份文件」并同意删除，'
    + '7 张 `_bak_qcdraft_*` 快照已由 `tools/migrate-drop-bak-snapshots-20261021.sql` DROP（两账套）。\n'
    + '> ⇒ 下面这段 INSERT 回滚**已不可用**；确实要恢复只能从数据库 `.bak` 还原。'
    + '删除前已核实「快照里的 78 张单在业务表命中 0」（即清理确实已生效）。'
  if (!s.includes(oldHdr)) throw new Error('锚点③未命中:' + oldHdr)
  s = s.replace(oldHdr, newHdr)
  fs.writeFileSync(p, s, 'utf8')
  console.log('[OK] _qc-insp-purge-20261021/README.md:回滚段已标注快照删除')
}
