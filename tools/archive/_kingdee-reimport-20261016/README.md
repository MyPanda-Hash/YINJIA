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
