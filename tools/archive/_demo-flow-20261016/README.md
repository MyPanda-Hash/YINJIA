# 生产链演示数据播种(2026-10-16 验收专项)

用户口径:「生产一直是生产中都没有已完工,还有其他视图数据等,不够真实,无法项目验收」。

## 病根(先量再改,全部有据)

| 看板位置 | 读什么 | 改前实测 |
|---|---|---|
| 工单状态分布 | `plang`:已完工 = `rk_no` 非空 | **有入库单号 = 0 行** ⇒ 已完工恒 0 |
| 车间生产分布 | `plang.scx` 分组 | **有产线 = 0 行**(429 张工单全未排产)⇒ 暂无数据 |
| 工序报工完成率 | `scjl` 按 `gxdm` 分组,完成率 = `wgzt` 非空占比 | **scjl 全库只有 7 行、都在 2026-08**(老系统电镀线),`gxdm` 全空、`报工单号` 全 NULL ⇒ 暂无数据 |
| 产能对比 · 实际产出 | `scjl.scxmc` 分组求和(只算 `wgzt='Y'`) | 同上 ⇒ 实际产出全 0 |
| 概览 · 待审批 | `yj_doc_status.pending='Y'` | **后端硬编码 `put("approvePending", 0)`**(`DashboardStatsService:162`)⇒ 恒 0,已一并修 |
| 概览 · 最新动态 | `yj_doc_status.shr/shsj` | 有数据(此前是探针字段名写错) |

## 播种口径(与引擎一致,不是瞎填)

- 全部工单的 `plang.工艺路线 = GY-CB-STD 炭棒标准路线`,工序链 = **成型 → 切炭 → 组装**(库里就三道);
- `scjl.gxdm` 存的是**工序名称**(`WoReportService.complete()` 拿它比对 `bs_route.工序名称`,且校验"不跳序");
- 报工单号前缀 **BG**(`yj_panel.WO_REPORT.prefix`),按**报工日期所在月**发号并登记 `s_allno`(防以后取号撞号);
- 完工判据与看板/`ScheduleBoardService.DONE_ROW` 一致:`rk_no` 非空 + `完工状态='生产完工'` + `cp_date2`;
- 报工行同时满足 `v_wo_completion_detail`(`RTRIM(wgzt)='Y'`),「完工明细」面板也有真实行;
- 完成度**按新老递减**(最新 3 单只做完成型、中段两道、老单三道全完)+ 留 1 张成型只报工未审
  ⇒ 工序完成率 **成型 92% / 切炭 100% / 组装 50%**,不是假的 100%;
- 最新 3 单的首道工序排在**今天**、分别落在成型1/2/3线 ⇒ 产能「日」视图当天就有 3 条线在产。

## 只动三处,全部可回滚

1. `plang` 选定 12 行:排产(`scx`/`asp_time2`)+ 完工(`rk_no`/`rk_sl`/`完工状态`/`cp_date2`),标记 `asp_user1='demo-flow-20261016'`;
2. `scjl` 追加 28 张报工单(带标记);`yj_doc_status` 追加对应状态行(已审核 23 / 待审批 2);
   ⚠ `yj_doc_status` **没有 `asp_user1` 列**,故按 `panel_code='WO_REPORT' AND doc_no LIKE 'BG-%'` 识别(库里原本没有 BG 单);
3. `bs_prod_line` 补齐未维护的日产能(成型 20000 / 切炭 30000 / 组装 25000,与同车间已维护值同口径)。

**不碰库存流水 `inh`/`outh`、不碰任何库存与报表口径。**

## 用法

```powershell
node tools/archive/_demo-flow-20261016/_seed-demo-flow.mjs --db HSDZ_MES            # 预演,只打印计划
node tools/archive/_demo-flow-20261016/_seed-demo-flow.mjs --db HSDZ_MES --apply    # 播种(两账套各跑一次)
node tools/archive/_demo-flow-20261016/_seed-demo-flow.mjs --db HSDZ_MES --cleanup --apply   # 按标记清理
```
执行后同目录生成 `rollback-<DB>.sql`(按标记与 id 逐行复位,可直接用 DbSync/sqlcmd 跑)。

## ⚠ 部署前必须清理

这批是**演示数据**(工单排产/报工/完工都是造的)。按 AGENTS「部署默认全量恢复备份」的口径,
打包前必须清理:`--cleanup --apply` 两个账套各跑一次,并确认
`SELECT COUNT(*) FROM scjl WHERE asp_user1='demo-flow-20261016'` = 0。
(同理:`bs_prod_line.日产能` 是档案主数据,清理由同一脚本复位为 NULL。)

## 验收自查

```powershell
node tools/archive/_perf-sweep-20261016/_q-dash-vitals.mjs http://127.0.0.1:8090   # 各模块"有没有货"体检
node tools/archive/_perf-sweep-20261016/_q-seed-verify.mjs HSDZ_MES                # 播种落库形态核对
node tools/archive/_perf-sweep-20261016/_q-dash-tab-shot.mjs http://127.0.0.1:8090 生产 dash-prod   # 生产页截图
```
