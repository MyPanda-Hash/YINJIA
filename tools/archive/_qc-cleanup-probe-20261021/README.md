# 来料检验链数据重建（2026-10-21）

> 一次性数据修复/造数，不是迁移脚本，不写 `yj_schema_log`。执行脚本：`QcRegen.java`。

## 一、执行结果（正式账套 HSDZ_MES）

| 对象 | 执行前 | 执行后 |
|---|---:|---:|
| 来料检验单 QC_INSP | 7 | 12 |
| 检验单明细 qc_insp_detail | 12 | 16 |
| 检验目录 qc_catalog | 1 | 1（JYML-2026-10-0001，已审核） |
| 目录明细 qc_catalog_detail | 7 | 16 |
| 检验数据记录 qc_insp_rec | 7 | 16 |
| 数据记录明细 qc_insp_rec_detail | 5 | 73 |
| 暂收退料单 qc_return | 7 | 12 |
| 退料单明细 qc_return_detail | 17 | 16 |
| 自动草稿采购入库单 | 3（PI-2026-10-0024/25/26） | 0（已删） |

- 重建范围：送料暂收单 `QC_RECV` 中商品档案 `bs_inv.来料检验='是'`、且**未作废**的 12 张暂收单 / 16 行。
- `SL-2026-10-0009`、`SL-2026-10-0010` 两行虽为“来料检验=是”，但暂收单已作废（`yj_doc_status.canceled='Y'`），按业务口径不生成。
- 所有检验单审核人/检验员=冯敏；检验目录审核人=冯敏；数据记录检验人/表单审核人=冯敏。
- 所有日期取来源暂收单的 `单据日期`：检验单 `单据日期/检验日期/审核时间`、明细 `日期`、数据记录 `单据日期/检验日期/来料日期`、退料单 `单据日期/明细日期` 均与之一致。
- 批次号与批次键逐行继承暂收单，并写入 `form_flow_link`。
- 检验数据记录按正常项目填写（外观/尺寸/克重/材质/检验数据1 等），每批保留一项不合格；因此检验单审核只生成**暂收退料单草稿**，不生成采购入库单。
- 退料单保持“草稿”（与系统审核自动生单口径一致），未审核。
- 历史已审核的 `PI-2026-10-0010`、`PI-2026-10-0015` 未删除（涉及已入账库存），仅清理了它们指向已删检验单的流转链。

## 二、删除与备份

删除前逐表 `SELECT * INTO` 备份：

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

同时清理了 `yj_doc_status`、`form_flow_link`、`yj_doc_modify_log` 中这四类面板的旧行。

## 三、复核

```bash
# 数据库核对
java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" \
  yinjia env archive/_qc-cleanup-probe-20261021/verify1.sql

# 接口核对（正式账套 YJ；admin/123456）
node archive/_qc-cleanup-probe-20261021/verify-api.cjs
node archive/_qc-cleanup-probe-20261021/verify-api-view.cjs
```

期望：12 张检验单全部 `已审核`、审核人冯敏；16 张数据记录 `已审核`；12 张退料单 `草稿`；`QC_INSP→PURCHASE_IN` 活跃链 = 0。

## 四、脚本

| 文件 | 用途 |
|---|---|
| `QcRegen.java` | 备份、删除、重建、校验（默认 dry-run，`--apply` 执行） |
| `fix1.sql` | 补齐数据记录状态、退料单检验单号/送检数量（执行中出现的小修） |
| `fix2.sql` | 检验目录补审核人（目录面板有「审核」动作，按用户“都要审核”口径置已审核） |
| `verify1.sql` / `verify2.sql` | 数据库逐项核对 |
| `verify-api.cjs` / `verify-api-view.cjs` | 后端接口核对 |

> 注：脚本里数据库连接沿用仓库既有默认（`yinjia` / 环境变量 `YINJIA_SQL_PASS`），未新增敏感信息。
