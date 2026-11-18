# 排单计划「未完成总数」→「工序未报工量」（2026-11-18）

用户口径（两轮，均带截图）：

1. > 排单计划中的未完成总数修改为当前工序还缺少的数量。名字改为工序未报工量
   > 数据也改为工序未报工量，当前字段存在工序计划量和报工量，前者减去后者得到这个数量即可
2. > 图一的应该是当前工序计划量-当前工序的报工数量。
   > 图二的这两个数量应该是按照工序换算率换算过的数量才对啊为什么还是订单数量？

## 改了什么

| 位置 | 改动 |
|---|---|
| `frontend/src/business/print-formats.js` | ① 纸表列 `未完成总数`（取 `未交量`，成品口径）⇒ **`工序未报工量`** = **当前工序计划量 − 当前工序完工量（报工数量）**，不足 0 记 0；新增纯函数 `planSheetUnreportedQty(row)`；② 同一行「生产计划数量」同步从 `工序计划量`（日计划接口按 `plang.当前工序` 算的）收口到 **`当前工序计划量`**，三列同一把工序尺 |
| `frontend/src/business/print-formats.test.js` | 表头/列序断言改名；`planSheetUnreportedQty` 用例覆盖「当前工序优先／工序计划量只做兜底／做够记 0」；纸面 480/280/200 断言；宽度断言改档位断言 |
| `docs/plans/2026-10-31-成型车间排单计划-报表.md` | §1 纸表列 → 系统字段表更新（工序未报工量 / 生产计划数量） |
| `docs/development/工单追溯-工序口径数量-20261115.md` | §7.1 追记 2026-11-18 的两处口径变更与原因 |

### 为什么「生产计划数量」也要一起改（不是顺手改）

`planSheet` 接口的 `工序计划量` 由日计划服务按 **`plang.[当前工序]`** 取换算率；而看板/台账显示的
「当前工序」是**台账里最前面的已落实道**。两者会漂移——实测 `GD-2026-11-0032`：

| 项 | 值 |
|---|---|
| `plang.[当前工序]`（`processTask/detail` 的「表头当前工序」） | 成型（旧值没回写） |
| 台账 `wo_process_line` | 成型 240（0.5，3号机）→ **组装装箱 480（1.0，4号车间）已落实** |
| 日计划 `工序计划量`（按成型算） | **240** |
| 看板 `当前工序计划量` / `本线排产数量` | **480**（装箱） |
| `当前工序完工量`（装箱已审报工） | **280** |
| 追溯弹窗「未完成合计」 | **200** |

⇒ 纸面原来会打「生产计划 240 / 实际完成 280」这种跨道的数；只用行上的「当前工序计划量 480」才自洽：
**生产计划 480 / 实际完成 280 / 工序未报工量 200**，与追溯「未完成合计 200」同数。

## 关于「图二那两列」（本线排产数量 / 当前工序计划量）

这两列**确实是按换算率算过**的，`本线排产数量 = 当前工序计划量 = 台账该道计划数量 = 排产数量 × 该道换算率`
（后端 `planQtyExpr` / 台账生成时已折算）。`GD-2026-11-0032` 这两列 = 480 是因为该行当前工序是
**组装装箱，换算率 = 1.0**：

| 工序（路线 `GY-2026-11-0003`） | 换算率 | 计划量 | 所在线（台账） |
|---|---|---|---|
| 成型 | **0.5** | **240** | 3号机 |
| 组装装箱 | **1.0** | **480** | 4号车间（计划线=实际线，状态已落实） |

480 恰好等于订单数量，是「装箱率 1.0」的结果，不是没换算。**成型那道（0.5 → 240）在 3号机**，
不在 4号车间；4号车间 是成型车间档案，但这条单的装箱台账被排到了 4号车间
（`wo_process_line.id=40279`，`_q-ledger.sql` 可见同类还有 2 行）——那是排产/台账数据，不是这两列算错。

⚠ 待用户确认：若希望 4号车间 这行按「成型」显示（240），要改的是台账/计划线（把装箱排到组装线），
或在看板上按"产线所属车间工序"取值——两条路都改语义，未擅自实施。

## 验证

1. **单测**：`cd frontend && node --test src/business/print-formats.test.js` ⇒ **39/39 PASS**。
2. **真机（5173 源码版，ego 浏览器真实点击，正式库 YJ）**：`round-03.mjs` ——
   工单排产页 → 选「4号车间」→ 勾第一行（GD-2026-11-0032）→ 点「排单计划」→ 读打印层 `#yj-print-host`：

   ```
   表头=[客户名称, 单据编号, 产品编号, 型号, 成型车间, 工序未报工量, 订单数量, 生产计划数量, 实际完成数量, …]
   行1: 订单=480 计划=480 完成=280 未报工=200
   [PASS] 列头 = 工序未报工量
   [PASS] 旧列头「未完成总数」已消失
   [PASS] 列位置:工序未报工量 在 生产计划数量 左侧
   [PASS] 逐行 未报工=计划−完成(1/1)
   ```
3. **纸面版式**：`round-04.mjs` 把打印层 HTML 按 A4 横向 `Page.printToPDF` ⇒ `plan-5173.pdf`
   ⇒ `plan-5173.png`（成品纸面，数值 200/480/480/280）。
4. **数据取证**（只读）：
   - `node _q-row.mjs` —— `planSheet` 行字段原值（`工序计划量 240 / 当前工序计划量 480 / 当前工序完工量 280`）；
   - `node _q-detail.mjs` —— 追溯弹窗的工序步骤与换算率（成型 0.5 → 240；组装装箱 1.0 → 480）；
   - `_q-3221.sql` —— `plang` / `wo_process_line` / `bs_route` 原表（证明 plang 当前工序仍停在成型）；
   - `_q-ledger.sql` —— 台账「工序 × 产线车间」分布（证明装箱被排到 4号车间只有极少数行）。

跑 SQL 用：`cd tools && "$JAVA_HOME/bin/java" -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia 'Yinjia@2026' ../tools/archive/_plansheet-unreported-20261118/_q-3221.sql`
（`java` 默认可能是 1.8，务必用 `$JAVA_HOME/bin/java`）。

## 复跑

```bash
cd frontend && node --test src/business/print-formats.test.js
ego-browser nodejs < tools/archive/_plansheet-unreported-20261118/round-03.mjs   # 5173 点击取证
ego-browser nodejs < tools/archive/_plansheet-unreported-20261118/round-04.mjs   # 纸面出 PDF
python -c "import fitz;d=fitz.open(r'tools/archive/_plansheet-unreported-20261118/plan-5173.pdf');d[0].get_pixmap(matrix=fitz.Matrix(3,3)).save(r'tools/archive/_plansheet-unreported-20261118/plan-5173.png')"
```

⚠ 本轮**没有**重建 `backend/src/main/resources/static` / 换 8090 jar —— 工作树里已有一批别人未提交的
前端构建产物（`static/assets` 新旧整批增删），此时再 `npm run build` 会把别人的半成品一起打进包。
8090 上看不到本改动，请用 5173 验收。
