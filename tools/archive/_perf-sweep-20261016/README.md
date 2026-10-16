# 响应速度专项(2026-10-16)

用户口径:「优化系统响应速度,看看有没有可以优化的点,但是不要破坏系统正常使用」。

## 结论(先量再改,全部有前后对比)

| 端点 / 页面 | 改前(中位) | 改后(中位) | 倍数 | 怎么改的 |
|---|---|---|---|---|
| `POST /px/scheduleBoard/stats`(快速排产页面本身) | **1015 ms** | **17 ms** | 60× | ① 补 `bs_inv(存货编码)` 索引 ② `stats()` 不再把整池行拉回来只为 `.size()` |
| `POST /px/scheduleBoard/pending`(待排产池) | **976 ms** | **31 ms** | 31× | 补 `bs_inv(存货编码)` 索引 |
| `GET /dashboard/flow`(桌面·流程管控) | **1228 ms** | **205 ms** | 6× | ① 同上索引 ② 节点数改走 `poolCount` ③ 每面板 4 条 SQL 合并成 2 条 |
| `GET /dashboard/stats`(概览) | 225 ms | 216 ms | ≈1× | 本来就不是瓶颈,未动 |
| `POST /px/queryFormDataList INV` | 167 ms / 6.5 MB | 172 ms / 6.5 MB | ≈1× | **不该动**(见下) |
| `queryFormDataList STOCK_LEDGER / STOCK_DETAIL` | 102 / 103 ms | 99 / 67 ms | 1.0–1.5× | 顺带受益(同一条派生 JOIN 链) |

## 根因(实测拆解,不是猜)

「待排产池」SQL 969 ms,逐段拆:
`原样 969 → 去掉「重点管控」派生 JOIN 6 ms → 去掉 dm_kh JOIN 5 ms → 只数数 2 ms → 去掉排序 972 ms`。
排除了坏计划(`OPTION (RECOMPILE)` 仍 933 ms)与排序因素,换 `EXISTS`(995 ms)/`OUTER APPLY`(1051 ms)同样慢
⇒ 真因是 **`bs_inv.存货编码` 没有索引**,优化器对每个工单行做一次 bs_inv 全表扫(3,917 行 × 宽行
nvarchar(400) 存货编码 + nvarchar(1000) 商品标签)。
测试账套先做实验:`957 ms → 20 ms(47×)`,再落成注册迁移 `tools/migrate-bsinv-invcode-index-20261016.sql`
(两账套已执行)。

同一段 `FROM bs_inv iv GROUP BY iv.存货编码` 派生 JOIN 还在 `ScheduleBoardService`(3 处)、
`WorkOrderListController`(生产工单列表)、`OrderConvertService`(订单结转)、`FlowBoardService`(流程管控)
⇒ 一条索引让**五个入口**一起提速。

## 刻意不动的地方(避免"优化"变成破坏)

- **`INV`(商品档案)6.5 MB / 172 ms**:这是**设计使然**。`QueryService.queryArchive` 注释写明
  「档案保存语义 = 全量明细 upsert(缺席行=已删除),因此查询必须返回全量行,否则截断会造成
  「未加载的行被误删」」,并有 `ARCH_LOAD_CAP` 护栏;前端也依赖"已载入的全量行"做保存前查重
  (《前端面板设计》§4.9)。改成分页 = 改保存语义 ⇒ **不做**。
  真要改需整体设计(后端查重已是兜底 + 前端改成分页维护),属独立任务。
- **`/dashboard/stats` 216 ms / 64 KB**:一次聚合十几个口径,216 ms 可接受;没有可归因的坏点,不动。

## 本目录

| 文件 | 作用 |
|---|---|
| `_q-api-timing.mjs` | 接口耗时/体积扫查(桌面 + 面板配置 + 10 张面板取数,3 次取中位) |
| `_q-pool-cost.mjs` | 待排产池 SQL 分段拆解(定位到「重点管控」派生 JOIN)+ 相关表规模/索引 |
| `_q-pool-fix-check.mjs` | 排除坏计划(RECOMPILE/EXISTS/OUTER APPLY)+ 三种写法结果一致性核对 |
| `_q-bsinv-index-experiment.mjs` | **建索引实验**(带 `--drop` 回滚),产出 47× 那份实测 |

复现:
```powershell
node tools/archive/_perf-sweep-20261016/_q-api-timing.mjs http://127.0.0.1:8090 3
node tools/archive/_perf-sweep-20261016/_q-pool-cost.mjs HSDZ_MES
node tools/archive/_perf-sweep-20261016/_q-bsinv-index-experiment.mjs HSDZ_MES_TEST        # 实验(会建索引)
node tools/archive/_perf-sweep-20261016/_q-bsinv-index-experiment.mjs HSDZ_MES_TEST --drop # 回滚
```

## 功能无回归的证据

- 流程管控活体界面 **14/14**(25 张节点卡、卡点数与接口一致、点卡跳面板、1440/768/375 三档)
- 节点数字与优化前**逐字一致**:卡点 `待排产工单 405 / 工单未排产(行) 405 / 订单待结转 311 / 产成品入库待审核 1`;`WO_REPORT.rows=7`
- `/px/scheduleBoard/stats` 返回字段与值不变(7 个字段;待排产笔数 405、产线 30、班组 10);`pending` 仍返回 405 行 × 16 列
- 迁移脚本自带索引存在性/键列自检;两账套 `DbSync` 到「执行 0、失败 0」
