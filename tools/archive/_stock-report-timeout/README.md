# 库存报表三表 取数优化 — 取证与验收留档(2026-10-15)

对应改动:`QueryService` 的 `countOnly` / `flatPageCap`、`PanelRuntimeService` 契约新增重载、
`PxController` 读 `countOnly`、前端 `engine.refRowCount` 带 `countOnly`。
姊妹留档(2026-09-22 第一次:坏计划 + RECOMPILE):[`../_probe-stock-perf/README.md`](../_probe-stock-perf/README.md)。

## 一、用户报障

「库存报表这 3 张表(库存状况表 STOCK_BALANCE / 库存台账 STOCK_LEDGER / 收发存汇总表 STOCK_SUMMARY)
因为数据量太大,出现 `timeout of 15000ms exceeded`。修改优化,改成一页 50 条数据也可以。」

## 二、先证伪一件事:每页**已经**是 50 条

`yj_panel.page_size` 三张都是 50,前端 `loadCrg()` 也照配置设了 `query.pageSize`
(真浏览器实测分页条「第 1/19 页」= 902 行 ÷ 50)。**所以"改成一页 50 条"不是没生效,而是不是瓶颈**。

## 三、真正的两处

### 3.1 打开面板就把整份商品档案搬一遍(主因,已有前科留档)

三张面板的「存货」字段 `ref_panel = INV`(商品档案,`archive` 模式,`bs_inv` 3,874 行 × 75 列)。
前端 `engine.refRowCount` 为了判「≤20 弹窗 / >20 下拉」只要一个行数,却走的是**完整取数**;
而 `QueryService.queryArchive` 按档案契约(**保存语义「缺席行=已删除」⇒ 必须全量**)忽略 `pageSize`,
——`pageSize:1` 也照样返回全部 3,874 行。

真浏览器(CDP)实测,**打开库存状况表**这一个动作发出的 `/api` 请求:

```
× 1  520 ms  INV|{"panelCode":"INV","condition":{},"pageNo":1,"pageSize":1}     ← 4,142,327 B
× 1  289 ms  STOCK_BALANCE|{"pageNo":1,"pageSize":50}
```

`_probe-stock-perf/README.md` §〇 早就把这一处记成「空闲 786 ms;有并行负载时实测 28~36 s(> 前端 15 s 超时线)」
并注明「2026-09-23 用户决定暂不做」—— 三张库存报表的「存货」参照全指 INV,于是**每次打开都踩它**。

### 3.2 服务端没有每页条数上限

面板声明了 50,但任何客户端(旧版前端、桌面小部件 `dashboard/index.vue` 的 `pageSize:500`、
手工调接口)要 500/5000 都照给。这两张视图的 `id` 是 `ROW_NUMBER() OVER(...)`,**要多少行就得把整份视图物化多少**,
单页行数直接等于计算量 ⇒ 加硬上限。

## 四、改动

| 文件 | 改动 |
|---|---|
| `QueryService.queryFormDataList` | 新增 `countOnly` 重载:照常算 `totalSize`,**不执行取数 SQL**(平表/单据/档案三种模式各一处早返回);台账合成行 +2 的计数逻辑提到早返回之前,`countOnly` 与常规请求的 `totalSize` 同口径 |
| `QueryService.flatPageCap` | 三张报表面板每页上限 = `yj_panel.page_size`(50);其它平表给 1000 行防呆上限,不受影响 |
| `PanelRuntimeService` | 新增 `countOnly` 重载(**default 方法**委托旧签名,契约向后兼容) |
| `PxController` | `/px/queryFormDataList` 读 `countOnly` 布尔 |
| `frontend/src/business/engine.js` | `refRowCount` 带 `countOnly: true` |

**口径零改动**:未动视图定义、金额列、`asp_cancel` 软删语义、台账期初/期末合成行。

## 五、验收(2026-10-15 12:1x,8090 新 jar,真库 HSDZ_MES)

`node tools/archive/_stock-report-timeout/_v-countonly-accept.cjs` → **ALL PASS**

| 项 | 修复前 | 修复后 |
|---|---|---|
| INV 计数请求(打开三张报表必发) | 4,142,327 B / 520~700 ms | **68 B / 36~150 ms**(热调 36,新进程首发 146)|
| INV 常规请求(档案页自己要全量) | 4,142,327 B | 4,142,327 B(**不变**,保存语义不受影响) |
| 三张报表 `pageSize=500` | 返 500 行 | **夹到 50 行**(113 / 68 / 125 ms) |
| 台账条件查询(仓库+存货+日期段) | — | 107~137 ms;首行=期初结存、末页末行=期末结存 ✓ |
| `totalSize` | 902 / 5,207 / 1,290 | 一致 |

真浏览器复跑 `_probe-stock-timeout-browser.mjs`:打开库存状况表后 `/api` 请求里
INV 那条已变成 `{"countOnly":true}`,**15 ms**,页面 50 行、分页「第 1/19 页」正常。

## 六、⚠ 间歇性 15 s 超时的真正来源(2026-10-15 下午追加)

用户追问「**是不是我当时在改后端或者增减数据导致的**」—— **是,而且这条才是间歇性超时的主因**;
§3.1/§3.2 是"打开就慢"的常驻成本,这一条是"平时好好的、一超就是 15 s"的来源。

### 6.1 现场状态:成本物化表是空的

| 项 | 值 |
|---|---|
| `inv_cost_ledger`(移动加权成本物化表) | **0 行** |
| `v_stock_balance` 的 `SUM(结存金额)` | 8,658,968.0950 |
| `v_stock_movement` 的 `SUM(收入金额)` | 8,658,968.0950(**一分不差**) |

⇒ 报表的「发出成本」这一层现在**完全没参与**,出库按 0 计价。见 [`q-11-cost.sql`](q-11-cost.sql)。

### 6.2 重算这段 SQL 现在要 2 分钟

`InvCostService.RECURSE`(`OPTION (MAXRECURSION 0)` 的递归 CTE)—— **只读**跑递归主体、
不带 `DELETE`/`INSERT`,5,207 行流水 / 894 个 `(仓库键,存货编码)` 分区:

| 次数 | 耗时 |
|---|---|
| 第 1 次 | **137,320 ms** |
| 第 2 次 | **141,449 ms** |

探针 [`q-12-recalc-timing.sql`](q-12-recalc-timing.sql)(只读,可复跑)。
而 `InvCostService` 的注释还写着「单据审核/弃审后调它(**235 行流水,成本可忽略**)」
—— 235 行的假设早已不成立(现 5,207 行,20 倍;递归段是 CTE 自连接逐行推进,随分区数退化)。

### 6.3 谁在跑它、锁住了谁

| 触发点 | 代码 |
|---|---|
| 8 类出入库单据 **审核 / 弃审**(每次!) | `ButtonService:4064 recalcInvCostIfStockDoc` → `invCost.recalcAll()` |
| 面板「重算成本」按钮 | `ButtonService:4069 recalcInvCost` |
| 启动自检(指纹不一致时) | `MesApplication:48` → `InvCostService.reconcileCostOnStartup` |

`recalc()` 是 `@Transactional`,方法体 = `DELETE FROM inv_cost_ledger` + 递归 `INSERT … SELECT`
⇒ **一个分钟级、全程锁住 `inv_cost_ledger` 的写事务**。而三张报表**都 JOIN 这张表**
(`v_stock_ledger`/`v_stock_balance` 里 `LEFT JOIN dbo.inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid`)
⇒ 只要有人在审核/弃审/重算/同步,报表读就排在锁后面 → **前端 axios 15 s 超时**。

### 6.4 回看本次排查早期的实测,全部对得上

- `Probe.java` 第一次(11:40~11:57,当时另一会话正在批量删/导数据):
  `COUNT v_stock_balance` **120 s**、`COUNT v_stock_ledger` **147 s**、`PAGE50 v_stock_balance` **158 s**;
  同一条跑过一遍后 30~45 ms。当时归因"自动统计信息/坏计划",**现在看更应是等锁**。
- 同一批里直接吃到一次**死锁牺牲品**(`SqlRunner` 报文:另一个进程持有可等待资源、当前会话被选作牺牲品)
  —— **只读查询能死在锁上,前提就是有并发写事务**。
- 库空闲时复测:三张报表接口 60~150 ms(§五)。

**所以:"改后端代码"本身不会让库变慢**(重编译只影响进程本身),但
①**重启服务 = 跑 DbSync 迁移**(`start-prod.ps1` 每次启动都同步,`ALTER TABLE`/`DELETE` 都是重写者);
②**审核/弃审单据、金蝶同步、点「重算成本」** 才是那个分钟级写事务的扳机。
"当时在增减数据"与现象完全吻合。

### 6.6 修好了什么、还卡在哪(2026-10-15 下午,已实施)

**① 重算路径重写(已改代码,`InvCostService`)**

| 步骤 | 旧 | 新 | 实测 |
|---|---|---|---|
| 取数 | 递归段每轮现场查 `v_stock_movement` 的 CTE | `SELECT … INTO #s` 落临时表 | 71~164 ms |
| 索引 | 无(堆) | `UNIQUE CLUSTERED INDEX (仓库键,存货编码,rn)` | 14~32 ms |
| 递归主体 | **137,320 ms**(再测 141,449 / 261,877) | 对着索引 seek | **70~302 ms** |
| 写库 | 递归算完才 DELETE(写锁覆盖整段) | 先算进 `#rec`,再 `DELETE`+`INSERT` | DELETE 13 ms / INSERT 330 ms |
| **合计** | **≈137~262 s** | **≈0.5~1.4 s** | ≈ **450 倍** |

**等价性已证**:新旧两条路径的输出做双向 `EXCEPT`(比 `src,rid,结存数量,结存金额,发出成本金额`)
—— **0 行差异**(`Probe4.java`)。所以这是纯提速,口径一行未改。

**② 重算根本写不进去的原因(已修)**

`v_stock_movement` 入库段是裸 `CAST(金额 AS decimal(18,4))`(出库段写的是 `CAST(0 …)`),
而 `inh.金额` 有 **807 行产成品入库单为 NULL** ⇒ INSERT 撞 `inv_cost_ledger.收入金额 NOT NULL`,
**每次重算都回滚** ⇒ 成本表长期 0 行、报表金额退化成「Σ入库金额」。
改法:在 #s 里就 `ISNULL(收入金额,0)`(与出库段「缺席即 0」对齐),并把**缺失行数打进 WARN 日志**
(口径缺口要看得见,不能静默按 0 计价)。

**③ 期初补进流水 + 重算成本(用户 2026-10-15 选方案 A,已执行完毕)**

方案:`tools/archive/_seed-opening-into-flow-20261015.mjs`(整段事务 + 默认 dry-run + 自检 + 成本预演),
把 10-14 那次推导的期初(2,004 键,跳过 116 个数量 0 的键 ⇒ 实写 **1,888 行**)补成 `inh` 的
`src=0 / 单据类型='期初结存' / 单据编号=INIT-20261014 / 单据日期=1900-01-01` 期初流水(与
`migrate-stock-flow-history-backfill.sql` 那批期初行同形),单价/金额留空(金蝶该接口 `unit_cost` 2,004/2,004 全空)。
**两账套都执行**(先正式后测试);写入前把现有期初行备份到 `_dump-out/init-rows-before-flow-{prod,test}-1015.csv`。

| 指标 | 补期初前 | 补期初后(两账套实测) |
|---|---|---|
| 流水行数 | 5,207 | **7,095**(+1,888 期初) |
| 流水分段 src=0 | 1 行 | **1,889 行** / 4,816,726.90 |
| 成本分区 | 894 | 1,611 |
| **末行结存数量 < 0 的分区** | **465(52%)** | **36** |
| **库存价值(各分区末行结存金额合计)** | **−94,873,791.73** | **+4,953,063.08** |
| Σ发出成本 | 103,532,759.83 | 3,705,905.02 |
| 流水净额 vs kucun 余量 | −323,341.83 vs 4,287,547.56 | **4,493,375.07 vs 4,287,547.56**(差 205,827.51,见下) |

重算成本随后由**启动自检**自动完成(重启 8090 后 `inv_cost_ledger` = **7,095 行**)。
三张报表最终:`库存状况表 1,634 行 / 现存量合计 4,493,375.07 / 结存金额合计 4,953,063.07`;
`库存台账 7,095 行`;`收发存汇总 2,737 行`。抽样自证:`TEST-MAT-A` 采购入库 2,550 → +250 = 2,800,
销售出库 30 件 × 25.4545 = **763.6364** → 期末 **2,036.3637** —— 移动加权口径正确。

**应用路径实测**:面板「重算成本」按钮 → HTTP 200、**640 ms**、`重算行数 7095`
(改写前同一条路径 137,320~261,877 ms,且那 2~4 分钟里三张报表全排在锁后面 ⇒ 前端 15 s 超时)。

**遗留(未动,非本次范围)**:流水净额比 `kucun` 多 **205,827.51** —— 这是既有的旁路分叉
(`库存表清单` §6 坑 4:不良品处理 `QC_DISPOSAL` 直接改 `kucun` 而不走统一过账,因此不进流水),
启动自检的「结存 == Σ流水」仍会点出这 20 万差额。


### 6.4b 为什么要先补期初:体检数据(**补期初前**的现场)

`Probe4` 体检(与 SQL 改写无关,是**源数据**问题):

| 项 | 值 |
|---|---|
| 分区数 | 894 |
| **末行结存数量 < 0 的分区** | **465(52%)** |
| 末行结存金额 < 0 的分区 | 59 |
| 库存价值(各分区末行 结存金额 合计) | **−94,873,791.73** |
| Σ收入金额 / Σ发出成本 | 8,658,968.10 / 103,532,759.83 |
| 典型异常行 | `YCL-01 / YJ-SX-001-2` 发出成本 **−15,112,867.80**;`YCL-01 / YJ-AJ-016-2` 结存金额 −41,818,614.57 |

根因是**期初结存不在流水里**:

- `2026-10-14` 的 `tools/archive/_seed-opening-stock-1014.mjs` 把金蝶现存量**只写进了 `kucun`**
  (`rkl=0/ckl=0`、`asp_user1='期初导入'`,实测 2,004 行),**没写进 `inh` 的 src=0 期初流水**;
- 当时 `inh` 的 src=0 只剩 **1 行**(数量 10)—— 设计里「期初 = src 0 / rid NULL / 单据日期 1900-01-01」
  那一层事实上是空的;
- 而三张报表与成本**都读流水** ⇒ 自然「出库多于入库」;
- 对账:**流水净额 −323,341.83 vs `kucun` 现存量 +4,287,547.56**(差 4.6 百万,
  `InvCostService.reconcileStockOnStartup` 的「结存 == Σ流水」这条自检本就在报警)。

⇒ 所以顺序必须是**先把期初落进流水,再重算成本**(按现状重算会把 −9,487 万写进成本层,
三张报表的「结存金额」会从 8,658,968(=Σ入库金额)变成 **−94,873,791**)。用户 2026-10-15 拍板走这条,**已执行**(见上 §6.6 ③)。

### 6.5 建议(按性价比)

1. **修重算 SQL(治本、优先)**:把 `s` 落进带聚簇索引 `(仓库键, 存货编码, rn)` 的临时表,
   递归段对着它 seek —— 现在是 CTE 自连接逐行推进,894 个分区就退化到分钟级。目标:秒级。
   顺带把空掉的 `inv_cost_ledger` 填回来(报表金额口径也一起恢复)。
2. **别让写事务堵住读**:开 `READ_COMMITTED_SNAPSHOT`(RCSI),报表读不再被写事务阻塞(需拍板)。
3. **重算失败要看得见**:`start-prod.ps1` 用 `Start-Process -WindowStyle Hidden` 起服务,
   **stdout/stderr 全丢**(`backend/backend-out.log`、`backend-err.log` 至今 0 字节)
   ⇒ 启动自检那句 `库存成本自检失败(不影响启动)` 谁也看不到。加个重定向即可。
4. 报表物化(§四 末尾那条)仍然成立,但优先级排在 1 之后。

## 七、留档文件

| 文件 | 内容 |
|---|---|
| `q-01-config.sql` / `q-02-shape.sql` | 面板配置与数据量、参与表规模/索引/统计信息新鲜度 |
| `q-03-qfields.sql` | 三张面板查询字段的参照源(证「存货 → INV」) |
| `q-04-cols.sql` / `q-05-dbs.sql` | `yj_field` 列清单 / 实例上的库清单与兼容级别(生产库 = **100**) |
| `Probe.java` / `Probe2.java` | DB 层计时:不带 hint 的 `COUNT(*)` 曾掉到 **120~158 s**,带 `OPTION(RECOMPILE)` 稳定 40~150 ms(§6.4 重新归因:那 120~158 s 更可能是**等锁**,不是坏计划 —— RECOMPILE 仍要保留,它是免疫陈旧计划的兜底) |
| `_v-stock-timeout.cjs` / `_v-inv-and-cascade.cjs` / `_v-repeat.cjs` / `_v-panel-cfg.cjs` | 接口层计时与面板配置取证 |
| `_probe-stock-timeout-browser.mjs` / `out-browser-repro.json` | **真浏览器复现**:逐请求列出打开的页面发了哪些 `/api`(修复前后对照) |
| `_v-countonly-accept.cjs` | **验收脚本**(ALL PASS 即达标,可复跑) |
| `q-06-bsinv.sql` / `q-07-locale.sql` | 顺带取证:两账套 `migrate-bs-inv-inspection-align-20261015.sql` 自检 —— 正式库 PASS、**测试库 FAIL(译名只落 1 条)**,见下方附记 |
| `q-08-schemalog.sql` / `q-09-recent.sql` | 迁移日志:本次重启实际执行了哪两条脚本(用于排除「漂移是不是我这次重启造成的」) |
| `q-10-writes.sql` | 报表源表最近被写的时间(证明当时确有并发写活动) |
| `q-11-cost.sql` | **成本物化表 0 行**、结存金额 == Σ收入金额(口径已退化) |
| `q-12-recalc-timing.sql` | **成本重算递归主体 137~141 s**(§六 的核心证据) |
| `q-13-scols.sql` | `v_stock_movement` / `inv_cost_ledger` 的列类型与索引(定 #s 的索引键大小) |
| `q-14-recalc-new-timing.sql`、`Probe3.java` | **改版重算试跑**(事务内 ROLLBACK):各步骤耗时 + 逐列空值 |
| `Probe4.java` | **新旧路径逐行比对(0 差异)+ 结果体检**(负库存分区 465/894、库存价值 −9,487 万) |
| `q-15-nullkeys.sql` / `q-16-rec-null.sql` | 空值定位过程(先误判成 仓库键,实为 **收入金额**) |
| `q-17-nullamount.sql` | 807 行 NULL 收入金额全是 **产成品入库单**(src=2) |
| `q-18-opening.sql` / `q-19-opening-proof.sql` | **期初不在流水**的证据:`inh` src=0 只剩 1 行;`kucun` 2,004 行 `asp_user1='期初导入'` |
| `q-20-initrow.sql` / `q-21-colnames.sql` | 期初行的完整形态(照它写新期初)+ 要用到的档案列名 |
| `_seed-opening-into-flow-20261015.mjs` | **把期初补进流水**(默认 dry-run + 自检 + 成本预演;`--write` 落库;两账套) |
| `q-22-after.sql` | 补期初 + 重算后的最终状态(成本表 7,095 行 / 报表合计 / 勾稽差 205,827.51) |
| `_v-recalc-button.cjs` / `_v-report-values.cjs` | 应用路径实测:重算成本按钮 **640 ms / 7,095 行**;报表数值抽样自证 |

## 八、复跑方式

```powershell
# 接口验收(需 8090 在跑)
node tools/archive/_stock-report-timeout/_v-countonly-accept.cjs
# 真浏览器复现(自带 headless Edge)
node tools/archive/_stock-report-timeout/_probe-stock-timeout-browser.mjs
```

## 附记:顺带发现的环境红灯(不属本任务,未改)

重启 8090 时 `start-prod.ps1` 的 DbSync 报:
`migrate-bs-inv-inspection-align-20261015.sql` **自检未过 ⇒ 中止,后续脚本未执行**。

追下去是**两账套不一致**(不是脚本写错):同一段自检逐条实测 ——

| 自检项 | HSDZ_MES(正式) | HSDZ_MES_TEST(测试) |
|---|---|---|
| `bs_inv.来料检验` 物理列 / 定义 nvarchar(10) NULL / 旧列已走 / 148 列 / 列注明 | ✓ | ✓ |
| `yj_field` 两条 INV 字段 | ✓ | ✓ |
| `yj_translation` 译名条数(要求 ≥10) | 10 + 10 | **1 + 1**(只有 `en`) |

⇒ 该迁移在测试库**没跑全**(两个账套都执行是硬规矩),测试库因此永远自检失败、DbSync 链条在后面所有脚本上被卡住。
按 `docs/development/环境与数据库.md`「测试库」节的判定口径,测试库是陈旧快照,
建议**不要逐条补**、直接 `powershell -ExecutionPolicy Bypass -File tools\scripts\make-test-db.ps1` 重建
(会覆盖测试库数据,需先确认可弃)。
