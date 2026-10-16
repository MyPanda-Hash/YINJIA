# plang / plang_pc / scjl 三表字段关联

> 2026-10-17 实测于正式库 `HSDZ_MES`（只读探针，脚本与输出见 §9）。
> 适用读者：改生产链（生产工单 / 快速排产 / 工序报工单 / 追溯 / 完工入库）的任何开发者。
> **一句话**：`plang` = 工单行，`plang_pc` = 排产行，`scjl` = 报工行；
> 三者的行级链是 `plang.id ← plang_pc.plang_id` 与 `plang_pc.id ← scjl.gd_id`，
> **`scjl.gd_id` 指向的是 `plang_pc.id`，不是 `plang.id`**（实测坐实，别再猜）。

---

## 1. 三表是什么

| 表 | 中文名 | 列数 | 数据量（2026-10-17 实测） | 粒度 | 面板 |
|---|---|---|---|---|---|
| `plang` | 工单（参考库遗留表） | 90 | 429 行 | **工单行**（同工单号可多行/多批次） | 非注册面板（生产工单列表页/看板直读） |
| `plang_pc` | 工单排产 | 77 | 2 行 | **排产行**（一行工单可被分多批排产） | 非注册面板（快速排产看板直读） |
| `scjl` | 生产记录（报工） | 100 | 4 行 | **报工行** | `WO_REPORT`（工序报工单）/ `WO_REPORT_LIST`（报工记录） |

三张表都是**参考库遗留表**（`tools/db-legacy-whitelist.txt` 冻结登记第 9 组），
**禁止新增此类拼音缩写表**（`docs/development/数据库规范.md` §建表规范 2），
但允许按既有口径扩列（先例：`scjl.工单行号`、`scjl.批次号`）。

---

## 2. 关联键（唯一权威）

```
                    plang                       plang_pc                    scjl
              ┌───────────────┐           ┌───────────────┐        ┌───────────────┐
   工单行身份 │ id            │◄──────────│ plang_id      │        │               │
              │ pl_no  工单号 │◄┄┄┄┄┄┄┄┄┄┄│ pl_no         │        │ gldh  工单号码│
              │ pl_xc  行号   │◄┄┄┄┄┄┄┄┄┄┄│ pl_xc         │        │ 工单行号(冗余)│
              │ 批次号        │◄┄┄┄┄┄┄┄┄┄┄│ 批次号        │        │ 批次号(镜像)  │
              └───────────────┘           │ id  排产行    │◄───────│ gd_id 工单ID  │
                                          └───────────────┘        └───────────────┘
                    1 ──────────── N              1 ──────────── N
```

| 关系 | 键 | 基数 | 口径 |
|---|---|---|---|
| `plang` → `plang_pc` | **`plang_pc.plang_id = plang.id`** | 1 : N | 权威行键；`plang_pc.id` 只标识"排产行" |
| `plang_pc` → `scjl` | **`scjl.gd_id = plang_pc.id`** | 1 : N | 权威行键；**只在报工「审核」时写定**（草稿期为空/0） |
| `plang` → `plang_pc`（冗余） | `comm + pl_no + pl_xc` | 1 : 1~N | 老口径，现役看板取数就靠它（见 §6）；同日多笔转单会撞（批次号已纯日期化） |
| `plang` → `scjl`（冗余） | `scjl.gldh = plang.pl_no` | 1 : N | **整单口径**；同工单多行时会把别的行带进来，只在拿不到行键时兜底 |
| `plang` → `scjl`（冗余） | `scjl.[工单行号] = plang.pl_xc` | 1 : N | 2026-10-15 新增列，供**草稿期**归属（此时无 `gd_id`）；须同时用 `gldh` 限定工单 |
| 物理外键 | — | — | **三表之间没有任何 FK 约束**（实测 `sys.foreign_keys` = 空），全靠应用维护 |

### 2.1 取行键的优先级（现役代码统一口径）

`WoReportService.reportRows` / `ScheduleBoardService.trace` / `ProcessTaskService` 三处同口径：

1. **`scjl.gd_id`**（= `plang_pc.id` → `plang_pc.plang_id` = `plang.id`）—— 已审核的报工单走这条；
2. **`scjl.[工单行号]`**（+ `gldh`）—— 草稿报工（`ButtonService.saveDoc` → `WoReportService.stampRowNo` 保存时落库）；
3. **`scjl.[批次号]`**（+ `gldh`）—— 老数据兜底，**恰命中 1 行才认**，多行不猜。

> 🔴 `WoReportService.complete()`（**审核**）只走 `pc JOIN plang ON pc.plang_id = p.id`，
> **没有冗余键兜底** —— 一旦 `plang_pc.plang_id` 悬空（§8 实测正在发生），审核会抛
> 「工单 X 未排产，不能报工」（误导性报错）。
> `cancel()`（弃审）有兜底（`ISNULL(pc.plang_id, (SELECT TOP 1 p.id FROM plang ...))`），不受影响。

### 2.2 禁止的写法

- ❌ 只用 `pl_no` / `gldh` 取行级数据（同工单多行会串行 —— 2026-10-10 用户报障的根因）；
- ❌ 用 `plang_pc.id` 当"工单行 id"（它是排产行 id）；
- ❌ 用 `批次号` 当行身份：批次号 = 转单日期 `yyyyMMdd`，**同一天多笔转单可重号**（`-2/-3` 后缀不是必然）。

---

## 3. `plang` → `plang_pc` 字段镜像

写点唯一：`WorkOrderScheduleRecord`（`create()` 建行时整批复制的 42 列；`sync()` 回写时**除 `od_no` 外**逐列对齐）。
调用方：`ScheduleBoardService.assign`（排入时 `create` / 已存在则 `sync`）、`ProcessTaskService`（排产数量/转序）、
`ManuWritebackService`（入库/领料回写）、`WorkOrderSplitService`（切单）。

**镜像列（42，`WorkOrderScheduleRecord.COLUMNS`）**：

```
comm, pl_no, pl_xc, pl_date, scx, pl_man, dm, mc, gg, gg2, jldw,
pl_sl, pl_sl2, xq_sl, rk_sl, yl, dj, jine, cp_date, st_date, cp_date2, rk_no, bz, ja,
od_no(仅建行时复制，sync 跳过), od_xc, lot_no, color, siz, lb, mjlx, BomId,
ll_no, wb_no, ll_no2, remark, MoDId, llxz, cgrkdh, lldh, djlx, zl, [批次号]
```

外加 `plang_pc.plang_id = plang.id`（`create` 时写定，语义见 §2）。

**只属于 `plang_pc`（不回写、`plang` 无此列）**：`jh_date`（订单交期）、`id`。

**只属于 `plang`（工单级，不进 `plang_pc`）**：
`ypl_sl`、`BomId` 之外的排产留痕 `打印人` / `打印时间` / `asp_print`、
切单血缘 `源工单号` / `源工单行id` / `拆分序号` / `根工单号` / `是否切单`、
工序推进 `工艺路线` / `当前工序` / `当前工序完工量` / `完工状态` / `完工时间`、
数量换算 `单位换算率` / `生产数量`、`备用1..20`、`asp_cancel` / `asp_user1..4` / `asp_time1..4`。

---

## 4. `plang` × `plang_pc` → `scjl` 字段镜像

写点唯一：`WoReportService.complete()`（**审核**那次 UPDATE；草稿行由面板保存时创建，只带面板登记列）。

| `scjl` 列 | 来源 | 说明 |
|---|---|---|
| `comm` | `plang.comm` | |
| `gd_id` | **`plang_pc.id`** | 权威行键，审核时写定 |
| `tm` | **工单号**（不是列复制，直接写 `gldh` 同值） | 条码位 |
| `scx` / `scxmc` | **`plang_pc.scx`** | 报工时刻**快照**（见 §7） |
| `jbbh`（班别） | **`plang_pc.lb`**（班组） | 列名不同、语义同源 |
| `wzdm`（物料编码） | **`plang.dm`**（产品代码） | 列名不同、语义同源 |
| `mc` / `gg` / `jldw` | `plang.mc` / `plang.gg` / `plang.jldw` | |
| `khdm` / `lot_no` | `plang.khdm` / `plang.lot_no` | |
| `pl_sl`（排产数量） | `plang.pl_sl` | 报工时刻**快照** |
| `od_no` / `od_xc` / `zl` | `plang.od_no` / `plang.od_xc` / `plang.zl` | |
| `llxz` / `djlx` | `plang.llxz` / `plang.djlx` | |
| `[批次号]` | `plang_pc.[批次号]` | 展示/检索用，锚点仍是 `gd_id` |
| `[工单行号]` | `plang.pl_xc` | 冗余展示列（2026-10-15 加） |
| `wgzt` / `wgsj` | 常量 `'Y'` / **应用本地墙钟** `LocalDateTime.now()` | **不能用 `GETDATE()`**（容器 TZ=UTC 会差 8 小时） |
| `jc_no` | 生成值 `产线--yyMMdd-8位序号` | ⚠ 列注明写的是「进厂编号」，实际用途是产成品流水 |
| `ywman` | 报工人（空则填当前用户） | |

**只属于 `scjl`**：`sc_no`、`报工单号`、`gxdm`（工序代码）、`sl`（报工数量）、`loss` / `loss_ra` / `bf_qty` / `bl_qty`、
`post_no`（**入库单号**，写点 `ButtonService` L2892 / `ManuWritebackService` L125）、`直销数量`、
`tm` 之外的 `cplsh`（产成品流水号）、`gs` / `gz` / `gsje`（工时工价）、`sl2` / `sl3`（盘数/每盘数量）、
`dwzt` / `dwsj` / `kszt` / `kssj`、`delmark`、`备用1..20`、`asp_*`。

**同名列但语义不同（不镜像，别混用）**：`id`、`sc_no`、`pp`（客户PO）、`lx`（挂具名称）、`sx`（纱型）、`jm`（计米）、
`sjd`（松紧度）、`cpcz`（产品材质）、`htys`（不良原因）、`other`、`kk`（扣款）、`zfjl`（需求数量）、
`ddwsl`（多单位数量）、`jh_date`（订单交期）、`asp_cancel` / `asp_print` / `asp_time*` / `asp_user*`、`备用1..20`。

---

## 5. 三表字段对照速查（按语义）

| 语义 | `plang` | `plang_pc` | `scjl` |
|---|---|---|---|
| 公司 | `comm` | `comm` | `comm` |
| 工单号 | `pl_no` | `pl_no` | `gldh`（另 `tm` 也写同值） |
| 工单行号 | `pl_xc`（注明"项次"） | `pl_xc` | `[工单行号]`（冗余） |
| 行级主键 | `id` | `id` + `plang_id`→`plang.id` | `gd_id`→`plang_pc.id` |
| 批次号 | `[批次号]` | `[批次号]` | `[批次号]` |
| 生产线 | `scx` | `scx` | `scx` / `scxmc` |
| 班组 | `lb` | `lb` | `jbbh` |
| 排产数量 | `pl_sl` | `pl_sl` | `pl_sl`（快照） |
| 需求数量 | `xq_sl` | `xq_sl` | `zfjl`（不同名列） |
| 入库 | `rk_sl` / `rk_no` | `rk_sl` / `rk_no` | `post_no` |
| 完工 | `完工状态` / `完工时间` / `ja` | `ja` | `wgzt` / `wgsj` |
| 工序 | `当前工序` / `当前工序完工量` | — | `gxdm` / `sl` |
| 客户 | `khdm` | `khdm` | `khdm` |
| 产品 | `dm` / `mc` / `gg` / `gg2` / `jldw` | 同左 | `wzdm`(=plang.dm) / `mc` / `gg` / — / `jldw` |
| 订单 | `od_no` / `od_xc` | `od_no` / `od_xc` | `od_no` / `od_xc` |
| 交期 | `cp_date`（计划完工日期） | `jh_date`（订单交期） | `jh_date` |
| 日期 | `pl_date`（工单日期） | `pl_date` | `sc_date`（生产日期） |
| 重量/颜色/尺码 | `zl` / `color` / `siz` | 同左 | `zl` / `color` / `siz` |
| 单据号 | `pl_no` | — | `[报工单号]` |
| 领料 | `ll_no` / `ll_no2`（领料单号 / 领料单号2） | `ll_no`（注明"**客户PO**"）/ `ll_no2`（注明"领料单号"） | —（无 `ll_no` 列） |

> ⚠ **`ll_no` 的注明冲突（待业务确认，勿擅自改代码）**：`plang.ll_no` 注明是「领料单号」，
> `plang_pc.ll_no` 注明是「客户PO」，而 `WorkOrderScheduleRecord.COLUMNS` **把 `ll_no` 当镜像列**
> （`plang.ll_no → plang_pc.ll_no`）⇒ 排产同步会拿"领料单号"覆盖"客户PO"位。
> 实测当前两表都无活数据，暂未暴露；改动该列前先找业务确认到底哪个语义是对的。

---

### 5.1 镜像列的长度不一致（真坑，实测 `sys.columns`）

镜像走的是 `INSERT ... SELECT p.列 INTO pc.列` / `UPDATE scjl SET 列=p.列`，
**宽度按目标表算**，源列更宽时由 SQL Server 决定「报错（ANSI_WARNINGS ON）还是静默截断」：

| 列 | 源（`plang`） | 目标 | 风险 |
|---|---|---|---|
| `khdm` | `nvarchar(40)` | `plang_pc.khdm` **`nvarchar(8)`** | ⚠ 建排产行（`WorkOrderScheduleRecord.create`）时最易踩 |
| `od_no` | `nvarchar(50)` | `plang_pc.od_no` **`nvarchar(24)`** | ⚠ `sync()` 已刻意跳过该列（注释写明"原有两表长度不同"），但 `create()` 仍复制 |
| `od_no` | `nvarchar(50)` | `scjl.od_no` **`nvarchar(24)`** | ⚠ 报工审核镜像时可能截断 |
| `dm` | `nvarchar(50)` | `scjl.wzdm` `nvarchar(50)` | 安全 |
| `[批次号]` | `nvarchar(12)` | 两表均 `nvarchar(12)` | 安全（值 `yyyyMMdd` / `-2` 后缀，够用） |
| `lb` | `nvarchar(10)` | `plang_pc.lb` `nvarchar(10)` / `scjl.jbbh` `nvarchar(250)` | 安全 |

> 改这几张表的列宽前先看这张表；**加宽源列而不加宽目标列 = 埋雷**。

### 5.2 文档台账的滞后（顺手记录，不属本任务）

`docs/development/数据库表清单.md` 现登记 `plang` **81** 列、`plang_pc` **76** 列，
实测（2026-10-17）分别是 **90 / 77** —— `plang` 差的 9 列即 2026-10-05 之后新增的
打印留痕 2 列 + 工艺路线推进 5 列（工艺路线/当前工序/当前工序完工量/完工状态/完工时间）+ 换算 2 列（单位换算率/生产数量）。
按 AGENTS.md 应「表结构变更后重跑清单末尾两条命令刷新」，本次**不单独刷新**（随后续结构变更一并重生成）。

---

## 6. 现役取数口径 vs 实测（2026-10-17，HSDZ_MES，只读）

| # | 口径（出处） | SQL 形态 | 实测 |
|---|---|---|---|
| ① | 快速排产看板 `ScheduleBoardService.scheduled/trace` | `plang_pc JOIN plang ON comm+pl_no+pl_xc` | **命中 1 行** ✅（冗余键是当前唯一活着的路） |
| ② | 行级权威键 | `plang_pc JOIN plang ON p.id = pc.plang_id` | **命中 0 行** ❌ 悬空 |
| ③ | 报工审核 `WoReportService.complete()` | `pc JOIN plang ON pc.plang_id=p.id AND pc.pl_no=?` | **命中 0 行** ❌ ⇒ 审核会抛「未排产」 |
| ④ | 报工→工单行 `resolveRowIdForReport()` | `scjl JOIN plang_pc ON pc.id=gd_id JOIN plang ON p.id=pc.plang_id` | 3 条已审核报工**全部解不到 plang 行** ❌ |
| ⑤ | 兜底 `工单号+批次号` | `plang WHERE pl_no=? AND [批次号]=?` | 恰命中 **1 行** ⇒ 兜底可用（巧合，别当常态） |
| ⑥ | 镜像字段是"活值"还是"快照" | 三表对照同一报工单 | 见 §7 |

---

## 7. 三条必须记住的语义（实测差异，不是 bug）

1. **`scjl` 的镜像字段是「报工审核那一刻的快照」，不是活值。**
   实测 `BG-2026-10-0047`：`scjl.pl_sl = 160` = `plang_pc.pl_sl = 160`，而 `plang.pl_sl` 现值 **500**
   （报工之后工单行被改过）；`scjl.scx = 装箱1(老厂)`（报工时产线），`plang_pc.scx` 现值也是装箱1(老厂)，
   但同批更早的 `BG-2026-10-0046/0044` 的 `scjl.scx = 1号车间` —— 报工当时线不同。
   ⇒ **不要用 `scjl.scx` / `scjl.pl_sl` 反推"现在排在哪条线/排了多少"**，那是历史快照。

2. **`plang_pc.plang_id` 是行级第一权威，但冗余键 `(comm, pl_no, pl_xc)` 才是当前唯一能跑通的路**（§6 ①②）。
   新代码**两条都要能用**：优先 `plang_id`，`plang_id` 取不到时退回冗余键（不要退回"只按工单号"）。
   反例 `WoReportService.complete()` 只认 `plang_id`，目前直接卡死（§8）。

3. **草稿报工不携带权威行键**：`scjl.gd_id` 只在**审核**时写定；草稿期靠 `[工单行号]`（保存时 `stampRowNo` 落库）
   或批次号归属。⇒ 界面/统计在草稿期按行归属时，必须用三级优先（§2.1），不能只查 `gd_id`。

---

## 8. 当前库的关联体检：`plang_pc.plang_id` 已悬空（需处置）

实测（正式库 `HSDZ_MES`，只读）：

| 项 | 实测值 | 判读 |
|---|---|---|
| `plang_pc` 全部行 | `id=575 plang_id=1127`、`id=576 plang_id=1128` | 两行的 `plang_id` 指向的工单行**不存在** |
| `plang` 现状 | 429 行，`id` **1..429 连续**，全部 `批次号=20261014`、全部 `GD-` 前缀 | 本机转单产物形态 |
| `IDENT_CURRENT` | `plang=1131`（max_id=429）、`plang_pc=578`、`scjl=1084`（max_id=79） | 三表都经历过「清空/重灌」，**id 空间被重置过**，`plang` 与 `plang_pc/scjl` 不再同源 |
| 冗余键能否补救 | 575（`xc=1`）→ `plang.id=10` 命中；576（`xc=2`）→ **0 行**（该工单在 `plang` 只有 1 行） | 一条可重锚、一条无对应工单行 |
| `scjl` 4 行 | 3 行 `gd_id=575`（命中 `plang_pc`，但 `plang_id` 悬空）；1 行 `gd_id` 空、`gldh` 空（草稿孤儿 `BG-2026-10-0045`） | 见 §2.1 |

**结论**：`plang_pc` / `scjl` 里的这 2 + 4 行与本机 `plang` **不是同一次灌入的数据**（不同 id 空间），
属于参考库快照残留 / 待清理数据。带来两个后果：

- 该工单**再报工会被拒**（§6 ③，报错文案误导为"未排产"）；
- 任何"按 `plang_pc.plang_id` 取数"的新路径在存量数据上都会静默取空。

**处置建议（按优先顺序，需业务确认后再动库）**：

1. **优先：按冗余键重锚**（窄条件 + 行数守卫，只认恰命中 1 行）：
   ```sql
   UPDATE pc SET pc.plang_id = p.id, pc.asp_user2 = N'reanchor', pc.asp_time2 = GETDATE()
   FROM dbo.plang_pc pc
   JOIN dbo.plang p ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND ISNULL(p.pl_xc,0) = ISNULL(pc.pl_xc,0)
   WHERE ISNULL(pc.asp_cancel,'N') <> 'Y' AND p.id <> pc.plang_id;
   ```
   命不中的（`id=576`，`xc=2`）**不要猜** —— 要么该工单行确实不存在（应连 `plang_pc` 行一起作废），
   要么应从同一快照补 `plang` 行，由业务定。
2. **或：按部署前清理口径清掉残留**（`tools/migrate-golive-cleanup.sql` 模式）——这批行不属真实业务，
   清了比错锚安全；清完 `plang_pc`/`scjl` 归零，报工链从"未排产"正常起步。
3. **代码侧加固（与数据无关，建议独立任务）**：`WoReportService.complete()` 加冗余键兜底
   （`ISNULL(pc.plang_id, (SELECT TOP 1 p.id FROM plang p WHERE p.comm=pc.comm AND p.pl_no=pc.pl_no AND ISNULL(p.pl_xc,0)=ISNULL(pc.pl_xc,0)))`），
   把"未排产"与"排产行未锚定"分开报错。

---

## 9. 取证与刷新（只读，可复跑）

```powershell
# 在 tools 目录；⚠ 库兼容级别=100 ⇒ 不能用 STRING_AGG；中文注明必须带 -Dstdout.encoding=UTF-8
cd tools
& "$env:JAVA_HOME\bin\java.exe" "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" `
  yinjia "<密码>" archive\_probe-plangpc-scjl-cols.sql      # 三表列清单(名/型/中文注明)
& ... archive\_probe-plangpc-scjl-cols2.sql                  # 补被 50 行上限截掉的列区间
& ... archive\_probe-plangpc-scjl-link.sql                   # 关联键体检(悬空/孤儿)
& ... archive\_probe-plangpc-scjl-join.sql                   # 现役三种 JOIN 口径逐条实跑
& ... archive\_probe-plangpc-scjl-ident.sql                  # IDENTITY 与数据规模
```

对应输出（同目录）：`_plangpc-scjl-cols.out.txt`、`_plangpc-scjl-cols2.out.txt`、
`_plangpc-scjl-link.out.txt`、`_plangpc-scjl-join.out.txt`、`_plangpc-scjl-ident.out.txt`。

代码侧权威出处：
`backend/.../service/WorkOrderScheduleRecord.java`（plang→plang_pc 镜像列，唯一的 42 列清单）、
`backend/.../service/WoReportService.java:318-330`（scjl 镜像 UPDATE）、
`backend/.../service/ScheduleBoardService.java:467-660`（看板冗余键 JOIN 口径）。

---

## 10. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-10-17 | 首版：三表角色/键链/镜像矩阵/同名异义坑/现役口径实测 + `plang_pc.plang_id` 悬空体检与处置建议 |
