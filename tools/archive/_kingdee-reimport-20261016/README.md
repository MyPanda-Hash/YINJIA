# 金蝶同步单据数据「导回来」(2026-10-16)

用户口径:「**把这个数据导进来**」→ 选定 **整批 26 个 CSV、两个账套都导**(先 `HSDZ_MES`,后 `HSDZ_MES_TEST`)。

## 为什么要导

`tools/archive/_dump-out/kingdee-data-1014/` 里那批 CSV,是 2026-10-14 从**正式库** `SELECT *` 导出的
金蝶同步单据(8 类单据头/行 7837 行 + 暂收/检验链路 9 表 1993 行 + `yj_doc_status` 留痕 2200 行),
导出目的就是「供同事在自己的库里还原」。本地两个账套这些表**几乎是空的**
(`bd_purchase_in` / `sale_out` / `material_out` / `finish_in` / `other_*`、`sl_recv`、`qc_insp`、
`form_flow_link` 全 0 行),所以要补回来。

## 怎么做(工具与口径)

工具:`_KingdeeImport.java`(走 JDBC,自带 CSV 解析与类型转换)

```powershell
cd tools
# 预演(只读,不写库;先看爆炸半径)
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar archive\_kingdee-reimport-20261016\_KingdeeImport.java archive\_dump-out\kingdee-data-1014
# 执行
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar archive\_kingdee-reimport-20261016\_KingdeeImport.java archive\_dump-out\kingdee-data-1014 --apply
# 测试账套:先 $env:YINJIA_SQL_DB="HSDZ_MES_TEST" 再同上
```

幂等口径(**以「单据」为单位,不是逐行**):

| 表 | 业务键 | 说明 |
|---|---|---|
| `bd_*`(单据头)、`bl_*`(单据行)、`sl_recv*`、`qc_insp*` | `单据编号` | 本地已有同号单 ⇒ **整单跳过**(头+行同口径),绝不插第二份 |
| `yj_doc_status` | `panel_code + doc_no` | CSV 无 `id`(该表自增),插完按业务键回滚 |
| `qc_insp_req` | `物料类别 + 物料编号` | |
| `plang` | `pl_no` | |
| `form_flow_link` | 无(本地为空) | 只按 `id` 去重 |

`id`(26 张表全为自增主键)作为第二道闸:`SET IDENTITY_INSERT ON` 保留原始 id,id 已存在也跳过。
其余细节:CSV 单元格为空 ⇒ `NULL`;数值/日期按目标列 JDBC 类型转换,转换失败的行**不插入**并点名(退出码 1,整表回滚);
CSV 比目标表多的列(如 `yj_doc_status.派生状态`)自动忽略并报告。

## 结果(两账套各一次,数字相同)

`合计:表 26 张 / CSV 12627 行 ⇒ 新增 10801 / 跳过(该单已在本地) 1797 / 跳过(id 已存在) 29 / 转换失败 0`

- 全跳过的单:采购订单 `bd_pu_order` 187、销售订单 `bd_so_order` 253、`bl_pu_order` 438、`bl_so_order` 472
  —— 这四张本地**早就有同号单**(本地是 `jdy-sync` 拉的另一批 id,见 `bd_pu_order.asp_user1`),故一律不重插;
- 新导进来的:采购入库 313 单、销售出库 415、生产领料 487、产品入库 232、其他入库 14 / 其他出库 79、
  送料暂收单 293 单(明细 488 行)、来料检验单 11 单、检验数据记录 30、`form_flow_link` 1252 行、`plang` 404 行、
  `yj_doc_status` 留痕 1760 行;
- 抽验(导入后实测):`sl_recv` 供应商/部门名称/单据日期已落库;`sl_recv_detail` 物料编码/数量/批次号已落库;
  `form_flow_link` 有 `PU_ORDER→QC_RECV→QC_INSP` 的占用链(数量 9000);`plang` 有 `pl_no/pl_date/od_no/mc/pl_sl`。

## 活体验证(8090 接口,两账套)

```powershell
node tools\archive\_kingdee-reimport-20261016\_q-kingdee-import-verify.mjs
```

两个账套逐面板查 `queryFormDataList.totalSize`,与导入结果**逐项一致**:
`PU_ORDER 223 / SO_ORDER 334 / PURCHASE_IN 313 / SALE_OUT 413 / MATERIAL_OUT 487 / FINISH_IN 232 /
OTHER_IN 14 / OTHER_OUT 79 / QC_RECV 293 / QC_INSP 11 / QC_INSP_REC 30`。
⚠ `SALE_OUT` 头表 415 行而列表 413 —— 差的 2 张是 `yj_doc_status.canceled='Y'`(**已作废,列表不列**),不是漏导。

## 补做「库存过账」(用户报:桌面库存只显示 1 条入库、出库一条没有)

**根因不是导入漏数据,而是导库绕过了应用**:库存流水(`inh`/`outh`)只由应用的**过账动作**写入
(`StockLedgerService`/`StockFlowService`,审核时同事务写 kucun + 流水),而桌面「库存」卡片
(`DashboardStatsService.stock()`)**正是读 `inh`/`outh`**。导库后单据与状态都在(界面显示「已审核」),
但流水一条没写 ⇒ 卡片里 `inh` 只剩 31 行期初、`outh` **0 行**。

处理(两账套各一次):

```powershell
cd tools
# ① 给已审核单据补写流水(src=1 采购入库 / 2 产成品入库 / 3 其他入库 / 5 销售出库 / 6 材料出库 / 7 其他出库)
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java run archive\_kingdee-reimport-20261016\backfill-stock-flow-imported.sql
# ② 按流水重建 kucun 结存缓存
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java run migrate-stock-flow-kucun-resync.sql
# ③ 全量重算移动加权成本物化表(面板「库存台账」→ 工具栏「重算成本」的等价调用)
```

⚠ 现成的 `migrate-stock-flow-history-backfill.sql` **已过期、跑不了**:它的 src=4/8 两段引用
`bl_outsource_in` / `bl_outsource_issue`,这两张表随委外面板 2026-10-08 下架已删 ⇒ 整脚本以
「对象名 'bl_outsource_in' 无效」中止。`backfill-stock-flow-imported.sql` 即其**现存 6 段**的等价替换
(逐列口径照抄,含 ③ 撤期初的同一守卫;已登记的迁移一律不改,改字节会被 DbSync 按哈希判为重跑)。

结果(两账套一致):

| 项 | 补前 | 补后 |
|---|---|---|
| `inh` 入库流水 | 31 行(全为期初 src=0) | 1,702 行(期初 31 + 采购入库 849 + 产成品 806 + 其他入 16) |
| `outh` 出库流水 | **0 行** | 3,317 行(销售出库 1,110 + 材料出库 2,093 + 其他出库 114;2 行已作废已排除) |
| `kucun` 结存 | 31 行 / 余量 7,011 | 996 行(单据口径) |
| `inv_cost_ledger` | 31 行 | 5,019 行(重算成本 5,019 行) |

桌面卡片与三张报表(接口实测,两账套相同):
**入库 559 单 / 出库 979 单 / 明细 5,019 行**;
`STOCK_LEDGER 5,019 · STOCK_BALANCE 1,366 · STOCK_STATUS 996 · STOCK_SUMMARY 1,781`。
核对脚本:`node tools\archive\_kingdee-reimport-20261016\_q-stock-flow-verify.mjs`

⚠ **已知副作用(需知情)**:`kucun` 里出现 **315 行负结存** —— 这批单是「金蝶拉取 + 2026-09-01 起」的
**子集**,本地没有对应的期初/更早入库单据(如销售出库的成品在 MES 里没有入库来源),
属数据不完整而非脚本引入(项目原注释早已记录同类现象「114 个分区只出无进」)。
要消掉负结存得补导更早区间或期初单据;31 行 `INIT-*` 期初因 (仓库,物料) 键与被单据覆盖的键不重合,
按守卫**原样保留**。

## 补做「号池回登」(否则新单会重发已用编号)

`FormNoService.next()` 是 `seq = MAX(RIGHT(dh,4)) FROM s_allno WHERE lb=前缀 AND ny=yyyy-MM ...` —— **只看号池自己**;
`exists()` 也只查 `s_allno` + `inh`。导库没走应用的取号 ⇒ 号池停在被导数据之前,`新增` 会**发出库里已存在的号**。
实测:本地 IJ 池末号 `IJ-2026-10-0010`,而库里已有 `IJ-2026-10-0011~0020`,造检验单时连撞 10 个重号。

```powershell
cd tools
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java run archive\_kingdee-reimport-20261016\backfill-formno-pool-imported.sql
```

口径与 `migrate-formno-style.sql` 的「历史横杠单号回登号池」一致:逐张单据头表取 `前缀-yyyy-MM-四位数字` 的行,
号池里没有的**补登一行**(`asp_user1='import-backfill'`);只增不删(删了会重发号,项目铁律)。
⚠ 紧凑格式(`前缀-yyyyMMdd-nnnnn`,如 `CGRK-20260901-03098`)与应用新格式天然隔离,**不需要**回登。
回登后:`SL` 293 → 号池 293 行、`IJ` 补齐 0011~0020、`JYSJ`/`GD` 同步(工单 `GD-2026-10-0222`)。

## 回滚

`rollback-HSDZ_MES.sql` / `rollback-HSDZ_MES_TEST.sql` —— 按本次真正插入的 id **逐表精确 DELETE**
(`yj_doc_status` 因为 CSV 没有 id:测试账套脚本按业务键逐行删;正式账套脚本按 id 区间
`id > 1756` —— 已核验导入前 548 行全在 1756 以内)。

```powershell
cd tools
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java run archive\_kingdee-reimport-20261016\rollback-HSDZ_MES.sql
```

⚠ 两个脚本都**不在** `tools/db-migrations.txt` 清单里,也**不要**登记(清理/回滚脚本禁止登记,见清单第 171 行红线)。
⚠ 数据是客户真实业务数据(客户/供应商/数量/金额/批次),仓库为云端共享仓库,按公司数据外发口径使用。
