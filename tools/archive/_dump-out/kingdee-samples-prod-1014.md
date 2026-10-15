# 金蝶 → MES 取样对照(每类 1 条真实单据)

- 金蝶账套:惠州市银嘉环保(outerInstanceId 580147507460444160,**只读**)
- 落库目标:**测试账套 HSDZ_MES_TEST**(正式库只录真实业务)
- 抓取时间:2026-10-14T11:38:15.739Z

## 产品入库单 — 金蝶 `inv_product` → MES 面板 `FINISH_IN`

- 取样单号:**CPRK-20261014-00005**(2026-10-14),分录 1 行

### 表头对照

| 金蝶键 | 金蝶值 | MES 物理列 |
|---|---|---|
| `bill_no` | CPRK-20261014-00005 | `单据编号` |
| `bill_no` | CPRK-20261014-00005 | `外部单据号` |
| `id` | 2590188938014675968 | `外部数据ID` |
| `bill_date` | 2026-10-14 | `单据日期` |
| `bill_type_name` | 产品入库单 | `单据类型` |
| `bill_type_name` | 产品入库单 | `业务类型` |
| `dept_name` | 原料车间 | `部门` |
| `dept_number` | BM00007 | `部门编码` |
| `emp_name` | 黄永品 | `经手人` |
| `emp_number` |  | `经手人编码` |
| `creator_name` | 蒋小刚 | `创建人` |
| `create_time` | 2026-10-14 18:42:21 | `创建时间` |
| `modifier_name` | 蒋小刚 | `修改人` |
| `modify_time` | 2026-10-14 18:43:03 | `修改时间` |
| `auditor_name` | 蒋小刚 | `审核人` |
| `audit_time` | 2026-10-14 18:43:03 | `审核时间` |
| `auditor_name` | 蒋小刚 | `金蝶审核人` |
| `audit_time` | 2026-10-14 18:43:03 | `金蝶审核时间` |
| `remark` |  | `备注` |
| `bill_status` | C | `单据状态` |
| `(派生)` | 是(单据来自金蝶) | `是否已转ERP` |
| `bill_no` | CPRK-20261014-00005 | `ERP单号` |
| `(系统)` | 金蝶同步 | `asp_user1` |

### 分录对照(共 1 行,取首行)

| 金蝶键 | 金蝶值 | MES 物理列 |
|---|---|---|
| `seq` | 1 | `序号` |
| `material_number` | TS45 | `产品编码` |
| `material_name` | TS45 | `产品名称` |
| `material_model` | TS45 | `规格型号` |
| `stock_name` | 恒亿仓 | `仓库` |
| `unit_name` | kg | `计量单位` |
| `base_unit_name` | kg | `基本单位名称` |
| `base_unit_number` | kg | `基本单位编码` |
| `base_unit_id` | 7 | `基本单位id` |
| `aux_unit_name` |  | `辅助单位名称` |
| `aux_unit_number` |  | `辅助单位编码` |
| `aux_unit_id` |  | `辅助单位id` |
| `conversion_rate` |  | `换算率` |
| `coefficient` | 1 | `换算系数` |
| `aux_coefficient` | 0 | `辅助换算系数` |
| `qty` | 123 | `实收数量` |
| `inv_qty` | 14 | `库存数量` |
| `batch_no` |  | `批号` |
| `picture` |  | `存货图片` |
| `comment` |  | `备注` |

> ⚠ MES 本地字段(无金蝶来源):产品入库单明细的 **检验方式**(全检/抽检)—— 金蝶保存接口对检验类键静默忽略,故取样时留空。

## 其他入库单 — 金蝶 `inv_other_in` → MES 面板 `OTHER_IN`

- 取样单号:**QTRK-20261014-00092**(2026-10-14),分录 1 行

### 表头对照

| 金蝶键 | 金蝶值 | MES 物理列 |
|---|---|---|
| `bill_no` | QTRK-20261014-00092 | `单据编号` |
| `bill_no` | QTRK-20261014-00092 | `外部单据号` |
| `id` | 2590130656491170816 | `外部数据ID` |
| `bill_date` | 2026-10-14 | `单据日期` |
| `trans_type_name` | 其他入库 | `业务类型` |
| `trans_type_number` | QTRKLX01 | `业务类型编码` |
| `trans_type_id` | 12 | `业务类型id` |
| `supplier_number` | GYS00014 | `供应商编码` |
| `supplier_name` | KG | `供应商` |
| `creator_name` | 蒋小刚 | `创建人` |
| `create_time` | 2026-10-14 16:46:53 | `创建时间` |
| `modifier_name` | 蒋小刚 | `修改人` |
| `modify_time` | 2026-10-14 16:47:16 | `修改时间` |
| `auditor_name` | 蒋小刚 | `审核人` |
| `audit_time` | 2026-10-14 16:47:15 | `审核时间` |
| `auditor_name` | 蒋小刚 | `金蝶审核人` |
| `audit_time` | 2026-10-14 16:47:15 | `金蝶审核时间` |
| `remark` |  | `备注` |
| `bill_status` | C | `单据状态` |
| `(派生)` | 是(单据来自金蝶) | `是否已转ERP` |
| `bill_no` | QTRK-20261014-00092 | `ERP单号` |
| `(系统)` | 金蝶同步 | `asp_user1` |

### 分录对照(共 1 行,取首行)

| 金蝶键 | 金蝶值 | MES 物理列 |
|---|---|---|
| `seq` | 1 | `序号` |
| `material_number` | YJ-KG-B12 | `存货编码` |
| `material_name` | 客供标签 | `存货名称` |
| `material_model` | 乐天鹅标B-46-14 | `规格型号` |
| `stock_name` | 华北工控仓 | `仓库` |
| `stock_number` | CK00006 | `仓库编码` |
| `unit_name` | 张 | `计量单位` |
| `base_unit_name` | 张 | `基本单位名称` |
| `base_unit_number` | 张 | `基本单位编码` |
| `base_unit_id` | 2167741887128111104 | `基本单位id` |
| `aux_unit_name` |  | `辅助单位名称` |
| `aux_unit_number` |  | `辅助单位编码` |
| `aux_unit_id` |  | `辅助单位id` |
| `conversion_rate` |  | `换算率` |
| `coefficient` | 1 | `换算系数` |
| `aux_coefficient` | 0 | `辅助换算系数` |
| `qty` | 1050 | `数量` |
| `aux_qty` | 0 | `辅助数量` |
| `inv_qty` | 0 | `库存数量` |
| `picture` |  | `存货图片` |
| `cost` | 0 | `成本` |
| `unit_cost` | 0 | `单位成本` |
| `comment` |  | `明细备注` |

> ⚠ MES 本地字段(无金蝶来源):产品入库单明细的 **检验方式**(全检/抽检)—— 金蝶保存接口对检验类键静默忽略,故取样时留空。

## 其他出库单 — 金蝶 `inv_other_out` → MES 面板 `OTHER_OUT`

- 取样单号:**QTCK-20261014-01173**(2026-10-14),分录 3 行

### 表头对照

| 金蝶键 | 金蝶值 | MES 物理列 |
|---|---|---|
| `bill_no` | QTCK-20261014-01173 | `单据编号` |
| `bill_no` | QTCK-20261014-01173 | `外部单据号` |
| `id` | 2590193619965257728 | `外部数据ID` |
| `bill_date` | 2026-10-14 | `单据日期` |
| `trans_type_name` | 其他出库 | `业务类型` |
| `trans_type_number` | QTCKLX01 | `业务类型编码` |
| `trans_type_id` | 13 | `业务类型id` |
| `dept_name` | 组装车间 | `部门` |
| `dept_number` | BM00005 | `部门编码` |
| `emp_name` | 余均亚 | `经手人` |
| `emp_number` | ZY00022 | `经手人编码` |
| `creator_name` | 蒋小刚 | `创建人` |
| `create_time` | 2026-10-14 18:51:41 | `创建时间` |
| `modifier_name` | 蒋小刚 | `修改人` |
| `modify_time` | 2026-10-14 18:52:21 | `修改时间` |
| `auditor_name` | 蒋小刚 | `审核人` |
| `audit_time` | 2026-10-14 18:52:21 | `审核时间` |
| `auditor_name` | 蒋小刚 | `金蝶审核人` |
| `audit_time` | 2026-10-14 18:52:21 | `金蝶审核时间` |
| `remark` |  | `备注` |
| `bill_status` | C | `单据状态` |
| `(派生)` | 是(单据来自金蝶) | `是否已转ERP` |
| `bill_no` | QTCK-20261014-01173 | `ERP单号` |
| `(系统)` | 金蝶同步 | `asp_user1` |

### 分录对照(共 3 行,取首行)

| 金蝶键 | 金蝶值 | MES 物理列 |
|---|---|---|
| `seq` | 1 | `序号` |
| `material_number` | S022 | `存货编码` |
| `material_name` | A+级烧结炭棒/滤芯 | `存货名称` |
| `material_model` | 45*25*178 | `规格型号` |
| `stock_name` | 成品B仓 | `仓库` |
| `stock_number` | CP-02 | `仓库编码` |
| `unit_name` | 支 | `计量单位` |
| `base_unit_name` | 支 | `基本单位名称` |
| `base_unit_number` | 支 | `基本单位编码` |
| `base_unit_id` | 3 | `基本单位id` |
| `aux_unit_name` |  | `辅助单位名称` |
| `aux_unit_number` |  | `辅助单位编码` |
| `aux_unit_id` |  | `辅助单位id` |
| `conversion_rate` |  | `换算率` |
| `coefficient` | 1 | `换算系数` |
| `aux_coefficient` | 0 | `辅助换算系数` |
| `qty` | 180 | `数量` |
| `aux_qty` | 0 | `辅助数量` |
| `inv_qty` | 1054 | `库存数量` |
| `batch_no` | PC0000 | `批号` |
| `comment` |  | `明细备注` |

> ⚠ MES 本地字段(无金蝶来源):产品入库单明细的 **检验方式**(全检/抽检)—— 金蝶保存接口对检验类键静默忽略,故取样时留空。
