# 库存报表读性能修复 — 取证与验收留档(2026-09-22)

对应迁移脚本 [`tools/migrate-stock-report-perf.sql`](../../migrate-stock-report-perf.sql)。
（原任务单 `docs/任务-库存报表视图性能修复.md` 已按用户要求删除；本文即为该任务的知识留档，
原文必要时可从 git 历史 `39fec94` / `79faad4` 取回。）

## 〇、2026-09-23 复验、更正与遗留（后续追加）

**复验（机器空闲、接口逐个计时）——修复仍有效**：

| 对象 | 实测 |
|---|---|
| `v_stock_balance` 直查 | **15 ms**（带 `OPTION (RECOMPILE)` 91 ms） |
| `v_stock_movement` / `bs_inv` 直查 | 6 ms / 5 ms |
| 索引与统计信息 | 16 张单据表的「单据编号」索引、`UX_kucun_id`、`ST_kucun_asp_cancel` 均在位 |
| 4 张报表接口（串行 3 轮） | 21 / 186 / 215 / 431 ms |
| 并发（4 张报表同打）中的 QC 面板 | 114 / 114 / 271 ms；并发墙钟 432 ms ≈ 最慢单次 431 ms |

**更正（撤回一处误判）**：曾把「两个 java.exe、只有一个绑 8090」当作**重复起服的后端实例**并 `Stop-Process` 杀掉。
2026-09-23 复查进程树为 `cmd.exe (8564) → java.exe (7228，1 线程/7 MB，启动器壳) → java.exe (2264，48 线程/403 MB，真身)`
—— 本机 JDK 25 执行 `java -jar` **本来就是「壳 + 真身」两个 java.exe**，属正常形态（杀壳进程无害也无益，服务照常跑）。
**判断是否真的重复起服，只看「监听 8090 的 PID 是否多于一个」，不要数 java.exe 个数。**
当时观测到的 25~76 s（`INV` 1.0 s→9.6 s、`STOCK_BALANCE` 76 s→16 s→311 ms）因此**只能归因于排查期间机器上的并行负载排队**，
不是面板或 SQL 退化；空闲复测全部回到百毫秒级。

**遗留热点（未修，用户决定不做）**：`INV` 商品档案是 `archive` 模式，按契约「全量返回」
（`ARCH_LOAD_CAP = 50,000`；保存语义「缺席行=已删除」要求全量加载）→ 3,838 行 = **4,020,278 B**，
空闲 786 ms、有并行负载时实测 28~36 s（> 前端 15 s 超时线）。
修法（保存改差异提交 + 列表服务端分页）已评估：能做，但会牵动列过滤/高级筛选/排序等前端全量计算逻辑与 35 个档案面板，
**2026-09-23 用户决定暂不做**。当前规避方式：不常驻该页面。
复验探针：[`_v-stock-perf-recheck.mjs`](_v-stock-perf-recheck.mjs)（接口计时 + 并发口径，可复跑）。

## 一、结论先行:根因是**坏缓存计划**,不是视图慢

任务单假设「视图本质慢」,实测**不成立**。同一条 SQL、同一份库、同一份数据、同一时刻:

| 对象 | 缓存计划 | `OPTION (RECOMPILE)` | 倍数 |
|---|---|---|---|
| `v_stock_movement` | **23,466 ms** | **36 ms** | ~650× |
| `v_stock_balance` | **65,021 ms** | **42 ms** | ~1,550× |

把 RECOMPILE 跑过一轮后,连**不带任何 hint** 的原查询也降到 `v_stock_movement` 5 ms /
`v_stock_balance` 7 ms —— 坏计划一旦被新计划顶掉,问题即消失。

**成因链**:

1. `v_stock_movement` 是 8 路 UNION 收敛 **16 张表**,而这 16 张表 **全部 `idx_n = 0`**
   (纯堆表、无任何索引);同库只有 `bs_wh`(1 个)与 `inv_cost_ledger`(2 个)有索引
   —— 恰好就是**不慢的两张表**。
2. 无索引 → 无可靠统计信息 → **兼容级别 100** 的基数估算把 UNION 产物估成 1 行 →
   选嵌套循环反复重算 → 放大约 600 倍。
3. 坏计划一旦进计划缓存就**永不重优化**,故现象稳定在 65 s / 190 s 而非偶发。

> **触发器推断**:数据库还原**不会清空计划缓存**,而本库是还原来的
> (`HSDZ_MES` create_date 2026-08-29,仓库里有 `fix-db-restore-20260915.sql`)。
> 还原后残留的旧计划与还原后数据不匹配,是最符合全部证据的解释。因 `yinjia`
> 无 `VIEW SERVER STATE`、也无 `SHOWPLAN` 权限(`sys.dm_exec_requests` / `SHOWPLAN_XML`
> 均报权限拒绝),无法直接取计划文本佐证,此条为推断而非实证。

## 二、修复

| 层 | 内容 |
|---|---|
| SQL(迁移) | 16 张单据头/行表各建 `[单据编号]` 索引(= 8 路 UNION 全部 JOIN 键);`bs_wh[仓库名称]` 索引;`kucun[id]` **唯一**索引;11 条 FULLSCAN 显式统计信息 |
| Java | `QueryService.queryFlat` 对这 4 张报表的取数 SQL 追加 `OPTION (RECOMPILE)` |

**为什么两层都要**:

- 索引 → 让优化器拿得到真实基数,**降低**选出坏计划的概率。
- `OPTION (RECOMPILE)` → 让报表取数**免疫**任何陈旧/残留计划。视图**不能带 hint**,
  故只能在取数 SQL 上补;这几张报表最大 247 行,单次编译约 ms 级,代价可忽略。
- **不做物化表**:任务单 §五.2/5 建议物化 `v_stock_movement`,但既然视图本身只有
  5~40 ms,物化只会引入刷新时序与「报表读到过期数据」的风险,无收益。

**口径零改动**:未动任何视图定义、金额列、`asp_cancel` 软删语义。

## 三、验收报数

### 3.1 单查询(任务单 §四.1 要求 < 1000 ms)

| 对象 | 修复前 | 修复后 | 出处 |
|---|---|---|---|
| `v_stock_balance` | 65,021 ms | **7 ms** | `out-02-localize.txt` → `out-17-dbaccept.txt` |
| `v_stock_movement` | 23,466 ms | **5 ms** | 同上 |
| `v_stock_ledger` | — | **4 ms** | `out-17-dbaccept.txt` |
| `v_stock_summary` | — | **8 ms** | 同上 |
| `kucun` | — | **0 ms** | 同上 |

### 3.2 接口(任务单 §四.2 要求 < 2000 ms)

`node tools/archive/_probe-stock-perf/_v-stock-api-perf.cjs` → **ALL PASS**(`out-30-api-accept.txt`)

| 面板 | 耗时 | totalSize |
|---|---|---|
| STOCK_BALANCE | 179 ms | 84 |
| STOCK_LEDGER | 173 ms | 235 |
| STOCK_SUMMARY | 197 ms | 137 |
| STOCK_STATUS | 32 ms | 31 |

> 多轮实跑区间 136~1,035 ms:首次调用(新进程登录后第一发)约 700~1,035 ms,是 JIT/连接池/
> 面板配置装载的冷启动成本;同进程连打 6 发稳定在 **136~239 ms**。**全部远低于 2,000 ms 阈值。**

### 3.2b 台账条件路径(单独回归)

台账在 仓库/存货/开始日期/结束日期 **四项齐全** 时,额外跑两条聚合 SQL 并合成「期初结存/期末结存」
两行 —— 这两条 SQL 同样带了 `OPTION (RECOMPILE)`,须单独回归:

| 项 | 结果 |
|---|---|
| 条件查询耗时 | page1 302 ms / page2 298 ms(totalSize=21)|
| 期初结存行 | 仅在 pageNo==1 出现 ✓(与修复前同口径)|
| 期末结存行 | 仅在最后一页出现 ✓ |

### 3.3 互不拖垮(§四.3 要求 < 500 ms)

修复前:库存查询进行中,无关面板 `queryFormDataList QC_RECV` 排队 **75,172 ms**。

修复后(串行与并发两种姿势):`QC_CATALOG` 27~55 ms、`QC_INSP_REC` 30~113 ms。**无 15 s 超时。**

### 3.4 并发不劣化(§四.5)

3 个库存面板 + 1 个无关面板同时发起:墙钟 **275 ms** ≈ 最慢单次 272 ms —— 无串行排队特征。

### 3.5 口径自证(§四.4)

| 项 | 值 |
|---|---|
| `SUM(结存金额)` | **3,099,936.6387** |
| 任务单记录值 | 3,099,936.64 |
| 差异 | 0.0017 元(为 `decimal(18,4)` 四舍五入的末位差,口径一致)|

`SUM(现存量)` = 30,666.0000;`v_stock_balance` 84 行 / `v_stock_movement` 235 行,修复前后行数不变。

## 四、留档文件

| 文件 | 内容 |
|---|---|
| `q-01-idx.sql` / `out-01-idx.txt` | 源表规模与索引(证明 16 张表 idx_n=0) |
| `q-02-localize.sql` / `out-02-localize.txt` | **坏计划取证**:movement 23,466 ms / balance 65,021 ms |
| `q-05-hypo.sql` / `out-05-hypo.txt` | **RECOMPILE 对照**:36 ms / 42 ms(差 600×) |
| `q-06-confirm.sql` / `out-06-confirm.txt` | 坏计划被顶掉后原查询转快;口径基准 3,099,936.6387 |
| `q-07-backend-shape.sql` / `out-07-backend-shape.txt` | 复刻后端参数化取数(OFFSET/FETCH)四面板计时 |
| `q-08-stats.sql` / `out-08-stats.txt` | 统计信息普查(参与表 0 索引、列统计为自动创建) |
| `q-10-kucun.sql` / `out-10-kucun.txt` | `kucun` 列清单 + 16 张表存在性 + `[单据编号]` 列核查 |
| `q-12-filtercols.sql` / `out-12-filtercols.txt` | `单据状态`/`单据状态2`/`asp_cancel` 分布(确认 `单据状态2` 只在采购单/销售单) |
| `q-13-bswh.sql` / `out-13-bswh.txt` | `bs_wh` 全列 + `kucun` 关键列 |
| `q-16-statscheck.sql` / `out-16-statscheck.txt` | 11 条显式统计信息落库核查(空表 `null` 属正常) |
| `out-20-migrate.txt` | 迁移执行输出(索引覆盖度 / 新建对象 / 视图耗时 / 口径合计) |
| `out-21-migrate-rerun.txt` | **幂等证明**:重跑 exit 0、索引无重复、口径不变 |
| `out-17-dbaccept.txt` | 最终单查询验收 + 口径自证 |
| `out-30-api-accept.txt` | **接口级验收 ALL PASS** |
| `q-18-kucunid.sql` / `out-18-kucunid.txt` | 安全性核查:`kucun.id` 是 **IDENTITY** 列 → 唯一索引不会卡住「不带 id 的 INSERT」 |
| `q-19-clean.sql` / `out-19-clean.txt` | 核查探针未留残留行(0 残留 / 仍 31 行) |
| `q-03-plan.sql` / `out-03-plan.txt` | **取计划失败留档**:`yinjia` 无 `SHOWPLAN` 权限 → 改用「同查询 RECOMPILE 对照」间接取证 |
| `q-09-restore.sql` | 库 create_date / 兼容级别(还原历史需更高权限,查不到) |

### 复跑方式

```bash
# 建索引与统计信息(幂等)
java -cp tools/lib/mssql-jdbc.jar tools/SqlRunner.java \
  "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=15" \
  yinjia "Yinjia@2026" tools/migrate-stock-report-perf.sql

# 单查询验收
java -cp tools/lib/mssql-jdbc.jar tools/SqlRunner.java "<同上jdbcUrl>" yinjia "Yinjia@2026" \
  tools/archive/_probe-stock-perf/q-17-dbaccept.sql

# 接口验收(需后端已在 8090 运行)
node tools/archive/_probe-stock-perf/_v-stock-api-perf.cjs
```

> `SqlRunner` 不回显 `PRINT` 且只回显每批第一个结果集 —— 本目录的 `.sql` 均已按「一句一批、
> 用 `GO` 分隔」写法适配;诊断信息一律 `SELECT` 成结果集返回。
