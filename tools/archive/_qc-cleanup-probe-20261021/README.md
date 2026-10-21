# 来料检验链数据重建（2026-10-21）

> 一次性数据修复/造数，不是迁移脚本，不写 `yj_schema_log`。
> 第一轮重建脚本：`QcRegen.java`；第二轮“混合结果 + 退料审批 + ERP 状态”脚本：`QcMixFix.java`。

## 一、最终状态（正式账套 HSDZ_MES）

| 对象 | 数量 | 说明 |
|---|---:|---|
| 来料检验单 `qc_insp` | 12 | 7 张合格 / 5 张不合格；全部已审核，审核人=冯敏 |
| 检验单明细 `qc_insp_detail` | 16 | 11 行合格 / 5 行不合格 |
| 检验目录 `qc_catalog` | 1 | `JYML-2026-10-0001`，已审核 |
| 目录明细 `qc_catalog_detail` | 16 | 11 合格 / 5 不合格，均已“完成检验” |
| 检验数据记录 `qc_insp_rec` | 16 | 11 合格 / 5 不合格，全部已审核 |
| 数据记录明细 `qc_insp_rec_detail` | 73 | 外观/尺寸/克重/材质/检验数据1 等 |
| 暂收退料单 `qc_return` | 5 | 仅保留不合格行；全部已审核，审核人/审批人=冯敏 |
| 退料单明细 `qc_return_detail` | 5 | 退货数量合计 9,200 |
| 采购入库单 | 0（本次检验单） | `QC_INSP→PURCHASE_IN` 活跃链 = 0；自动草稿入库单已删 |

- 来源：送料暂收单 `QC_RECV` 中商品档案 `bs_inv.来料检验='是'`、且未作废的 12 张暂收单 / 16 行。
- `SL-2026-10-0009`、`SL-2026-10-0010` 两行虽为“来料检验=是”，但暂收单已作废，按业务口径不生成。
- 不合格行（5 行）：
  - `IJ-2026-10-0205 / YJ-XH-002`（水分 0.72%）
  - `IJ-2026-10-0208 / YJ-YKRS-009`（水分 0.72%）
  - `IJ-2026-10-0211 / YJ-XH-002`（水分 0.72%）
  - `IJ-2026-10-0214 / YJ-YPS-002`（水分 0.72%）
  - `IJ-2026-10-0216 / Y-S-Z`（含量 96.8%）
- 退料单：`TH-2026-10-0003`（0205）、`0006`（0208）、`0009`（0211）、`0012`（0214）、`0014`（0216）。
- 退料单转 ERP：`是否已转ERP=是`，ERP 单号按金蝶采购退货单格式生成：
  `CGTH-20260915-00001`、`CGTH-20260927-00002`、`CGTH-20261005-00003`、`CGTH-20261019-00004`、`CGTH-20261020-00005`；
  操作人/时间=冯敏/单据日期。**未实际调用金蝶**，只回写了转 ERP 状态与单号。
- 所有日期取来源暂收单 `单据日期`：检验单 `单据日期/检验日期/审核时间`、明细 `日期`、数据记录 `单据日期/检验日期/来料日期`、退料单 `单据日期/审核时间/审批时间/转ERP时间/明细日期` 均一致。
- 批次号/批次键逐行继承暂收单，并写入 `form_flow_link`（QC_RECV→QC_INSP 16 条、QC_INSP→QC_RETURN 5 条）。
- 审批留痕：`yj_form_approval` 中检验单 12 条 AUDIT、数据记录 16 条 AUDIT、目录 1 条 AUDIT、退料单 5 条 APPROVE，操作人=冯敏。
- 历史已审核的 `PI-2026-10-0010`、`PI-2026-10-0015` 未删除（涉及 10-19 已入账库存），仅清理了它们指向已删检验单的流转链。

## 二、删除与备份

第一轮（全删重建）备份：

```
_bak_qcregen_20261021_qc_insp
_bak_qcregen_20261021_qc_insp_detail
_bak_qcregen_20261021_qc_catalog
_bak_qcregen_20261021_qc_catalog_detail
_bak_qcregen_20261021_qc_insp_rec
_bak_qcregen_20261021_qc_insp_rec_detail
_bak_qcregen_20261021_qc_return
_bak_qcregen_20261021_qc_return_detail
_bak_qcregen_20261021_yj_doc_status
_bak_qcregen_20261021_form_flow_link
_bak_qcregen_20261021_bd_purchase_in（仅 3 张自动草稿）
_bak_qcregen_20261021_bl_purchase_in（仅 3 张自动草稿）
```

第二轮（改混合结果/审批退料/ERP）前备份：

```
_bak_qcmix_20261021_qc_insp
_bak_qcmix_20261021_qc_insp_detail
_bak_qcmix_20261021_qc_insp_rec
_bak_qcmix_20261021_qc_insp_rec_detail
_bak_qcmix_20261021_qc_catalog_detail
_bak_qcmix_20261021_qc_return
_bak_qcmix_20261021_qc_return_detail
_bak_qcmix_20261021_yj_doc_status
_bak_qcmix_20261021_form_flow_link
_bak_qcmix_20261021_yj_form_approval
```

同时清理了 `yj_doc_status`、`form_flow_link`、`yj_doc_modify_log`、`yj_form_approval` 中已删单据的残留。

## 三、复核

```bash
# 最终数据库核对
java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" \
  yinjia env archive/_qc-cleanup-probe-20261021/verify-mix.sql

# 接口核对（正式账套 YJ；admin/123456）
node archive/_qc-cleanup-probe-20261021/verify-api.cjs
node archive/_qc-cleanup-probe-20261021/verify-api-view.cjs
```

期望：12 张检验单全部已审核（7 合格 / 5 不合格）；16 张数据记录已审核；5 张退料单已审核且已转 ERP；`QC_INSP→PURCHASE_IN` 活跃链 = 0。

## 四、脚本

| 文件 | 用途 |
|---|---|
| `QcRegen.java` | 第一轮：备份、全删、重建、校验（默认 dry-run，`--apply` 执行） |
| `QcMixFix.java` | 第二轮：11 合格/5 不合格、重建退料单、审批退料单、回写 ERP 状态、清理入库单（默认 dry-run，`--apply` 执行） |
| `fix1.sql` / `fix2.sql` | 第一轮执行中的小修（记录状态、退料单检验单号/送检数量、目录审核） |
| `cleanup-orphan.sql` / `insert-approvals.sql` | 清理已删单据审批残留、补齐审核留痕 |
| `verify1.sql` / `verify2.sql` / `verify-mix.sql` | 数据库逐项核对 |
| `verify-api.cjs` / `verify-api-view.cjs` | 后端接口核对 |

> 注：脚本里数据库连接沿用仓库既有默认（`yinjia` / 环境变量 `YINJIA_SQL_PASS`），未新增敏感信息。
