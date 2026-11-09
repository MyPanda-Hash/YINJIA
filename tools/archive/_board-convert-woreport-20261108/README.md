# 取证归档 — 排单冻结列 / 订单结转备品 / 报工记录产品字段(2026-11-08)

用户口径(2026-11-08 一次性提出 4 条需求,本目录是这三组改动的可复跑取证):

1. 「排单界面物产品编码、产品规格、订单数量,显示在前面冻结,方便看。……还需要考虑当前冻结后
   如何显示其他的信息对其他信息进行处理要如何实现。」
2. 「订单结转工单,数量只能小于等于订单数;考虑有备品的情况,数量需要大于订单数。
   让当前的订单结转的本次转单数量可以超出这个销售订单的数量。」
3. 「报工记录,需要显示产品编码、产品规格。」
4. 「报工记录,要能根据产品编码/客户编码/产品规格查询报工记录,这个原来的查询功能就能实现,
   也就是说当前的报工记录需要增加这些内容。」

对应提交:`feat: 工单排产冻结产品编码/产品规格/订单数量三列`、
`feat: 订单结转本次转单数量允许超订单数量(备品)`、
`db: 报工记录增产品编码/产品规格显示列与产品编码/客户编码/产品规格查询字段`。

## 目录内容

| 文件 | 作用 |
|---|---|
| `round-01.mjs` | 工单排产页:读列头顺序 + `el-table-fixed-column--left` 集合 + 横向滚到最右后冻结列坐标 |
| `round-02.mjs` | 工单排产页(2号车间,3 行真实数据):冻结列行内取值 + 滚动中态截图 |
| `round-03/04.mjs` | 订单结转:把「本次转单数量」填成 剩余+100,读红框 class/「超订单」小标/二次确认框;点**取消**(不落库) |
| `round-05.mjs` | 报工记录:列表列 + 查询栏字段 + 截图 |
| `round-06/07.mjs` | 报工记录:查询条件 UI 端到端(产品规格=60*45 → 列表 50→6 行) |
| `round-08.mjs` | 报工记录:「产品编码」参照弹窗(商品·参照选择 3899 条)可开、可关键字过滤 |
| `round-09.mjs` | 切 en 走查新文案(Over order / Transfer qty exceeds …),**结束后恢复原语言**(不污染浏览器偏好) |
| `round-10.mjs` | 终验截图:工单排产未滚动状态(冻结列在左 + 其余列在右),只截表格区域 |
| `evidence/*.jpg` | 6 张关键截图(原图 3640×1765,缩到 1600 宽便于入库;原图在 ego 空间 `wo-board-freeze-20261108/`) |
| `_verify-e2e-orderconvert.mjs` | 8091 并行实例 × **测试账套**(YJ_TEST)端到端:过了剩余量转单 → 回读 plang/占用链(见下) |
| `_verify-woreport-query.mjs` / `_2.mjs` | 打 8090 现役接口验 `queryFormDataList` 新字段过滤(产品编码/客户编码精确、产品规格 LIKE) |

## 复跑方式

```bash
# ① UI 取证(需要 5173 vite 在跑;ego 空间已建,按 round 顺序跑)
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_board-convert-woreport-20261108/round-01.mjs')"
# 其余 round-02…09 同法替换文件名

# ② 报工记录查询(打现役 8090,只读;admin/YJ)
node tools/archive/_board-convert-woreport-20261108/_verify-woreport-query2.mjs

# ③ 订单结转备品端到端(需 8091 并行实例,详见下节;会往**测试账套**写 1 张工单,验完必须清理)
node tools/archive/_board-convert-woreport-20261108/_verify-e2e-orderconvert.mjs
```

8091 并行实例起法(不碰 8090、不 `mvn package`——jar 被 8090 锁住会出台瘦 jar 事故):

```bash
cd backend
JAVA_HOME=/c/Users/vigna/.jdks/ms-25.0.4 mvn -o -q dependency:build-classpath -Dmdep.outputFile=../.tmp/cp2.txt
"$JAVA_HOME/bin/java" -cp "target/classes;$(cat ../.tmp/cp2.txt)" com.yinjia.mes.MesApplication --server.port=8091
```
(本机默认 `java` 是 1.8,必须用 JDK 25;`-Dstdout.encoding` 在 pwsh 里会被拆参,用 `JAVA_TOOL_OPTIONS` 更稳。)

## 三条需求的验收结论(当日实测)

1. **排单冻结列**:表头 43 列;`fixed-column--left` 恰为 `[工单号, 产品编码, 产品规格, 订单数量, 客户]`
   (右侧固定仍只有「生产状态」);行内取值正确(例 GD-2026-10-0227 → B-58-07 / 48*30*264.5 / 6000);
   横向滚到最右(scrollLeft≈1977)冻结列仍固定在原 x 坐标。原来夹在滚动区的「物料编码/规格型号/需求数量」
   三列已删除(前移不复制),其余列全部留在滚动区。
2. **订单结转备品超量**:前端(5173)填 剩余+100 → 输入框红框 + 「超订单」小标 + tooltip;
   点「转工单」弹「备品超订单提示」(超出行数 1 / 合计超出数量 100),取消未落库。
   后端(8091 + YJ_TEST):订单行 `ZXL-20261016-03#8766` 剩余 306,填 356 →
   生成 `GD-2026-11-0001`(测试库),`plang.xq_sl=pl_sl=356`、`form_flow_link.linked_quantity=356`;
   验证后已清理(plang/plang_pc/wo_process_line/form_flow_link 残留全 0)。**正式账套零写入**。
3. **报工记录字段与查询**(两账套迁移均已执行):列表新增 产品编码/产品规格(客户编码只查询不出列);
   查询栏 15 个条件含这 3 个;`queryFormDataList` 过滤 产品编码=C-58-15→6、客户编码=C-58→15、
   产品规格=60*45→6;UI 填 产品规格=60*45 回车后列表 50→6 行。

## 已知边界 / 未做项

- **8090 现役 jar 未重建**:前端改动只对 5173(源码即时生效)可见;8090 的 static 与 class 仍是上一版。
  纯前端 + 一个 class 的落 jar 需按下发流程整包(当天工作区还有并行会话的 WIP,故刻意不重建 static,
  避免把半成品打进 jar)。
- 前端全量单测:`node --test` = 1540 tests / 1535 pass / 5 fail;5 个失败全部是
  `recordSheetConfigs.livedb.test.js` 需要 `SQLCMD.EXE`(本机没装)导致的**环境性**失败,与本次改动无关。
- 测试账套(HSDZ_MES_TEST)是旧快照:其 `scjl` 有效行仅 13 行,商品/客户档案与报工数据不同源;
  用正式库样例值在测试账套查会 0 行,属预期。
