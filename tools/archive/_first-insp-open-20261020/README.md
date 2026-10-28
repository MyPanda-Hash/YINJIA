# 首件检验单「直接关联生产工单」取证与验收（2026-10-20）

用户口径：「查看当前系统内的首件检验单的实现，当前是被流程卡死，不完成成型报工就不能产生当前的首件检验单，
当前直接实现对这个，首件检验单需要关联当前的生产工单即可，不需要实现成型报工完成流程才产生。就是当前检验单
能选取工单，未完工的工单就可以选取，但是已经完成的就不需要能被选取，已经被当前的检验单选取的也不能被再次选取。」

设计与改动清单见 **`docs/design/首件检验单-直接选工单.md`**。本目录是这次任务的**只读取证 + 验收探针**。

## 内容

| 文件 | 用途 |
|---|---|
| `_Q.java` | 一次性只读查询器（JDBC 直连两账套，执行 `q*.sql`，不改任何数据） |
| `q1.sql` | 现状：存活工单行的 完工状态/产线/ja 分布、首件单存量与覆盖的工单行数 |
| `q2.sql` | 未完工行明细（含该行已有几张存活首件单）+ 最近 10 张首件单 |
| `q3.sql` | 列类型核对（`qc_first_insp_head.工单号/工单行号` 与 `plang.pl_no/pl_xc` 同型，关联比较不会隐式转换） |
| `q4.sql` | **新准入口径的 SQL 直证**：未作废 + 未结案 + 未完工 + 无存活首件单（正式 1 行 / 测试 9 行） |
| `q5.sql` | 面板字段核对：`工单号` 在 `QC_FIRST_INSP` 上是**必填**（空单存不了，建单只能从选工单/报工来） |
| `q6.sql` | **「为什么显示未开工」取证**（2026-10-20 追加）：`GD-2026-10-0223#1` 的 完工状态/完工时间/当前工序/产线/ja/排产/入库 全量 + 报工 0 笔 + 预排台账 0 行 |
| `q7.sql` | 两账套**未完工行**的 完工状态 vs 报工笔数对照（证明「未开工」也会是陈旧值：测试库 `GD2608260013` 有 1 笔已审 280 件仍写未开工） |
| `q8.sql` | `完工状态` / `生产状态` 作为 **yj_field 标签**分别挂在哪些面板（WO_REPORT_LIST / MANU_SCHEDULE）—— 决定这两个词要不要进语言包 |
| `_i18n-first-insp-open.mjs` | 10 个语言包的词条脚本（替换首件旧提示 + 新增门槛提示/生产状态五态/完工状态/未开工，幂等） |
| `_probe-first-insp-open.mjs` | **接口验收**：两账套的 `woLines` 集合对照 + 生产状态与 SQL 独立口径对照 + 已完工行建单 400 + 未完工可建 + 幂等（建单只在测试账套，跑完删单） |
| `_probe-first-insp-picker-ui.mjs` | **界面验收**（CDP/Edge headless）：首件弹窗的提示/列头/行数/生产状态/建单全流程 + 制程弹窗回归；支持 `en` 第二参数 |
| `_probe-workorder-status.mjs` | **生产工单列表回归**：`/api/px/workOrderList` 的「生产状态」五态、与 SQL 独立口径逐行一致（两账套 397 行） |

## 怎么复跑

```powershell
# 只读取证（tools 目录，需 JDK 25；默认密码 Yinjia@2026，可用 YINJIA_SQL_PASS 覆盖）
cd tools
& "$env:USERPROFILE\.jdks\ms-25.0.4\bin\java.exe" -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar `
    archive\_first-insp-open-20261020\_Q.java HSDZ_MES archive\_first-insp-open-20261020\q4.sql
& "$env:USERPROFILE\.jdks\ms-25.0.4\bin\java.exe" -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar `
    archive\_first-insp-open-20261020\_Q.java HSDZ_MES_TEST archive\_first-insp-open-20261020\q4.sql

# 接口验收（8090 现役实例）
node tools\archive\_first-insp-open-20261020\_probe-first-insp-open.mjs http://127.0.0.1:8090
node tools\archive\_first-insp-open-20261020\_probe-workorder-status.mjs http://127.0.0.1:8090

# 界面验收（5173 = 源码即时生效 / 8090 = 打包产物；第二个参数可传 en）
node tools\archive\_first-insp-open-20261020\_probe-first-insp-picker-ui.mjs http://localhost:5173
node tools\archive\_first-insp-open-20261020\_probe-first-insp-picker-ui.mjs http://localhost:5173 en
```

## 本次结论（2026-10-20 实测）

- `HSDZ_MES`：存活工单行 385，其中 **384 已完工且已结案**，**唯一未完工的是 `GD-2026-10-0223#1`**
  —— 改前它连 `pickable`（要有产线）都过不了 ⇒ 弹窗里全是已完工行、而且全被成型门禁置灰。
- `HSDZ_MES_TEST`：未完工且未被占用的 9 行，改后全部可选。
- 接口 **22/22**、生产工单列表回归 **8/8**、界面 zh-CN **16/16**、界面 en **13/13**、前端单测 801 例（5 例为既有的活库环境项）。

## 追加：状态列「完工状态」→「生产状态」（同日，用户报障）

现象：弹窗那列对 `GD-2026-10-0223#1` 显示「未开工」，用户问「为什么」。

取证（`q6.sql`）：这行 `plang.完工状态` 是 **NULL**（`完工时间/当前工序` 也空），没产线、没预排台账、
**报工 0 笔** —— `完工状态` 只在报工审核/看板推进时由 `ProcessTaskService` 重算写入，这行从没被算过。
屏上的「未开工」是前端对空值的兜底（推断），而同一行在「生产工单」列表里的**生产状态**是「未排产」⇒ 两处对不上。

改法：新增 `PlangStatus`（五态：未排产/已结案/完工/在产/未完工），生产工单列表与首件选工单弹窗共用；
弹窗列头改「生产状态」。现在这行显示 **未排产**，与生产工单列表一致。
