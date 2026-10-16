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

## 第二轮:商品(INV)页面打开卡顿(用户口径「商品这个页面打开也会卡一下」)

**先量**:用 `_q-inv-open.mjs` 把"卡"拆成网络/体积/渲染/主线程四段(带 TEAM 作对照):

| 指标 | 商品(INV)改前 | 对照 TEAM | 商品(INV)改后 |
|---|---|---|---|
| 取数响应 | 160 KB 传输 / **6541 KB 解码** | 1 KB | 不变(数据本身) |
| el-table 首屏行数 | 25(配置 page_size) | 20 | 25 |
| **DOM 节点总数** | **239,320** | 1,638 | **4,171**(57×↓) |
| **最长主线程长任务** | **485 ms** | 143 ms | **186 ms** |
| 长任务总阻塞 | 667 ms | 143 ms | 445 ms |

**根因**:DOM 普查(`YJ_CENSUS=1`)显示 `TD=231,935 / TR=3,945`,而"谁扛着 TD"聚合直指
**`.dp-table` = 231,103 个** —— 那是**打印专用版式层**(`PanelxList.vue` 的 `.doc-print`,
屏幕恒隐藏、打印时才显示),它把**全部 3,917 行 × 59 列**照建进 DOM。el-table 自己只渲染
配置的 25 行(实测 `表格 #0 行25/节点2940`),所以卡的是这一层,不是表格、不是网络。

**改法(行为守恒)**:打印层**按行数分流**——
- 行数 ≤ 300(普通单据面板,几行到几十行):**照旧常驻渲染**,打印三条路径(Ctrl+P / 浏览器菜单 / 页面「打印」按钮)行为一个字节不变;
- 行数 > 300(档案面板,几千行):默认不渲染;打印入口先 `await ensureDocPrintLayer()` 把层挂上再 `window.print()`,
  Ctrl+P 走 `keydown` 拦截(打印层已就绪时不拦截,仍走浏览器原生路径),`afterprint` 再把它收回去。

**打印输出守恒的证据**(`_q-print-layer-check.mjs`,7/7)→ 触发 Ctrl+P 后:打印层行数 **3,917 × 59 列**
(全部明细行,与改造前一致)、`body.doc-printing` 生效、`window.print` 被调用、`@page A4 landscape` 已注入;
单据面板 `PURCHASE_IN` 打印层**未触发打印即常驻**(行 3)。

**刻意不动**:6.5 MB 负载本身**没有冗余** —— 实测 72 列里只有 `id` 未在 `yj_field` 登记(占 JSON 体积 1.4%),
且它是档案行键(`archiveRowIdOf`)必需;剩下一律是面板登记字段。要再降只能改"档案全量载入"的设计(见 §刻意不动)。

**覆盖范围**(`_q-lazy-scope.mjs`,阈值 300 行):档案面板共 36 张,其中只有 **3 张**超过阈值 ——
`INV`(3,917 行)× `WHLOC`(679)× `ZDGL`(413);其余 33 张最多 82 行,**照旧常驻渲染、零变化**。
改前 INV 这一层白建 ≈ 3,917 × 113 列(实测 231,935 个 `<td>`,列合并后少于此估算)。

新增探针:`_q-inv-open.mjs`(打开耗时四段拆解 + DOM 普查)、`_q-print-layer-check.mjs`(打印层守恒)、
`_q-inv-config.mjs`(分页配置取证)、`_q-inv-payload.mjs`(负载列/字节画像)、`_q-lazy-scope.mjs`(影响范围)。



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
