# 金蝶同步单据数据导出(近一个月)

- 来源库:**HSDZ_MES(正式)**;筛选:`asp_user1='金蝶拉取'` 且头表单据日期 ≥ **2026-09-01**
- 导出时间:2026-10-14T14:35:53.673Z
- 合计 **7837** 行 / 约 2.2 MB(UTF-8 无 BOM,首行表头)

| 单据 | 头表 CSV | 头行数 | 行表 CSV | 行数 |
|---|---|---|---|---|
| 采购订单 | `bd_pu_order.csv` | 187 | `bl_pu_order.csv` | 438 |
| 销售订单 | `bd_so_order.csv` | 253 | `bl_so_order.csv` | 472 |
| 采购入库单 | `bd_purchase_in.csv` | 313 | `bl_purchase_in.csv` | 849 |
| 销售出库单 | `bd_sale_out.csv` | 401 | `bl_sale_out.csv` | 1082 |
| 生产领料单 | `bd_material_out.csv` | 487 | `bl_material_out.csv` | 2094 |
| 产品入库单 | `bd_finish_in.csv` | 231 | `bl_finish_in.csv` | 807 |
| 其他入库单 | `bd_other_in.csv` | 14 | `bl_other_in.csv` | 16 |
| 其他出库单 | `bd_other_out.csv` | 79 | `bl_other_out.csv` | 114 |

## 怎么用

1. **导入自己的库**:CSV 与 MES 表列一一对应(`SELECT *` 全列导出),按 `单据编号` 关联头/行;
2. **要重新从金蝶拉**:用 `tools/archive/_pull-kingdee-docs-1014.mjs`(需金蝶账套凭据,幂等、可 `--types/--limit` 试跑);
3. **字段含义与金蝶键对照**:见 `docs/development/出入库单据字段与显示字段.md` 与 `tools/archive/_dump-out/kingdee-*-fields-1014.md`。

> ⚠ 这是**客户真实业务数据**(含客户/供应商/数量/金额/批次),仓库为云端共享仓库,请按公司数据外发口径使用。
## 单据状态(必须一起导,否则界面显示草稿)

- 界面/流程状态**不是**物理列「单据状态」,而是**工作流派生** —— 真源表 `yj_doc_status`:
  `shr` 非空=已审核 / `pending=Y`=审批中 / `canceled=Y`=已作废 / `archived=Y`=已完成 / `stopped=Y`=已中止;都没有=草稿。
- 本目录 `yj_doc_status.csv` 即这批单据的留痕(含 `派生状态` 列便于核对),导库时一并写入 `yj_doc_status`;
- 只导单据表不导留痕 ⇒ 同事侧一律显示「草稿」(与正式库表现不一致)。
- 本次留痕行数:2166(SO_ORDER:253 / PU_ORDER:187 / QC_RECV:119 / QC_INSP:9 / QC_INSP_REC:73 / PURCHASE_IN:313 / FINISH_IN:231 / OTHER_IN:14 / MATERIAL_OUT:487 / SALE_OUT:401 / OTHER_OUT:79)