# 材料出库样本(MES 正式库 ↔ 金蝶真实账套)

拉取时间:2026-10-04T09:15:25.512Z

## ① MES 正式库 HSDZ_MES —— bd_material_out 2 张 / bl_material_out 4 行

### 单号 CL-2026-08-2501(表头)

| 列 | 值 |
|---|---|
| id | 1 |
| 单据日期 | Tue Aug 25 2026 08:00:00 GMT+0800 (中国标准时间) |
| 单据编号 | CL-2026-08-2501 |
| 业务类型 | 材料出库 |
| 生产车间 | 精整车间 |
| 出库类别 | 直接领料 |
| 来源单号 | MO-2026-08-0007 |
| 单据状态 | 草稿 |
| asp_user1 | migration |
| asp_time1 | Mon Aug 31 2026 20:11:04 GMT+0800 (中国标准时间) |
| asp_cancel | N |

明细 4 行:

| id | 单据编号 | 仓库 | 加工单号 | 材料名称 | 计量单位 | 数量 | 单价 | 金额 | 规格型号 | 现存量 | asp_user1 | asp_cancel | 行号 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CL-2026-08-2501 | 原料仓 | MO-2026-08-0007 | 6063铝棒 | kg | 411.4 | 0 | 0 | Φ120 | 4200 | migration | N | 1 |
| 2 | CL-2026-08-2501 | 辅料仓 | MO-2026-08-0007 | 包装木箱 | 件 | 6.8 | 0 | 0 | 1200×800 | 300 | migration | N | 2 |
| 3 | CL-2026-08-2501 | 原料仓 | MO-2026-08-0007 | 6063铝棒 | kg | 411.4 | 0 | 0 | Φ120 | 4200 | migration | N | 3 |
| 4 | CL-2026-08-2501 | 辅料仓 | MO-2026-08-0007 | 包装木箱 | 件 | 6.8 | 0 | 0 | 1200×800 | 300 | migration | N | 4 |

### 单号 CL-2026-08-2501(表头)

| 列 | 值 |
|---|---|
| id | 2 |
| 单据日期 | Tue Aug 25 2026 08:00:00 GMT+0800 (中国标准时间) |
| 单据编号 | CL-2026-08-2501 |
| 业务类型 | 材料出库 |
| 生产车间 | 精整车间 |
| 出库类别 | 直接领料 |
| 来源单号 | MO-2026-08-0007 |
| 单据状态 | 草稿 |
| asp_user1 | migration |
| asp_time1 | Wed Sep 23 2026 20:58:49 GMT+0800 (中国标准时间) |
| asp_cancel | N |

明细 4 行:

| id | 单据编号 | 仓库 | 加工单号 | 材料名称 | 计量单位 | 数量 | 单价 | 金额 | 规格型号 | 现存量 | asp_user1 | asp_cancel | 行号 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CL-2026-08-2501 | 原料仓 | MO-2026-08-0007 | 6063铝棒 | kg | 411.4 | 0 | 0 | Φ120 | 4200 | migration | N | 1 |
| 2 | CL-2026-08-2501 | 辅料仓 | MO-2026-08-0007 | 包装木箱 | 件 | 6.8 | 0 | 0 | 1200×800 | 300 | migration | N | 2 |
| 3 | CL-2026-08-2501 | 原料仓 | MO-2026-08-0007 | 6063铝棒 | kg | 411.4 | 0 | 0 | Φ120 | 4200 | migration | N | 3 |
| 4 | CL-2026-08-2501 | 辅料仓 | MO-2026-08-0007 | 包装木箱 | 件 | 6.8 | 0 | 0 | 1200×800 | 300 | migration | N | 4 |

## ② 金蝶真实账套 —— 生产领料单 inv_pick(总数 4828,取回 3 张)

### 金蝶 SCLL-20260929-00009(2026-09-29,C)

| 键 | 值 |
|---|---|
| id | 2579991369582016512 |
| bill_no | SCLL-20260929-00009 |
| bill_date | 2026-09-29 |
| bill_status | C |
| create_time | 2026-09-30 16:58:48 |
| modify_time | 2026-09-30 17:02:18 |
| audit_time | 2026-09-30 17:02:18 |
| creator_id | 425692977 |
| creator_name | 蒋小刚 |
| creator_number | multicorp_6171610_-952599178 |
| modifier_id | 425692977 |
| modifier_name | 蒋小刚 |
| modifier_number | multicorp_6171610_-952599178 |
| bill_type_name | 生产领料单 |
| bill_type_number | inv_pick_bill |
| bill_type_id | inv_pick_bill |
| auditor_id | 425692977 |
| auditor_name | 蒋小刚 |
| auditor_number | multicorp_6171610_-952599178 |
| dept_id | 2170469887338617856 |
| dept_name | 组装车间 |
| dept_number | BM00005 |
| emp_id | 2208993878466477056 |
| emp_name | 周荣香 |
| emp_number | ZY00049 |
| custom_field | [object Object] |
| pick_type | 1 |

material_entity 8 行:

| seq | id | material_id | material_name | material_number | material_is_multi_unit | material_is_serial | material_is_asst_attr | material_is_kf_period | material_is_batch | material_model | stock_id | stock_name | stock_number | stock_is_allow_freight | batch_no | kf_period | sn_list_id | base_unit_id | base_unit_name | base_unit_number | unit_id | unit_name | unit_number | qty | inv_qty | base_qty | inv_base_qty | aux_qty | def_float_qty | aux_coefficient | coefficient | price | cost | unit_cost | src_inter_id | src_seq | src_entry_id | custom_entity_field | src_product_entry_id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2579991369582017536 | 2184983164051613696 | 端盖 | YJ-SX-034 | false | false | false | false | true | 灰色大咖（超棉+丝印） | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 2167741063610021888 | PCS | PCS | 2167741063610021888 | PCS | PCS | 3000 | 4800 | 3000 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 2 | 2579991369582016513 | 2184986593423642624 | 垫片 | YJ-SX-043 | false | false | false | false | true | 10寸（TPR） | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 2167741063610021888 | PCS | PCS | 2167741063610021888 | PCS | PCS | 9800 | 14800 | 9800 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 3 | 2579991369582017537 | 2484219777065799680 | PP棉 | YJ-TS-033 | false | false | false | false | true | 40±1*30+1*497.5±0.5 | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 3 | 支 | 支 | 3 | 支 | 支 | 2400 | 23391 | 2400 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 4 | 2579991369582016514 | 2184983515433652224 | 端盖 | YJ-SX-035 | false | false | false | false | true | 蓝色大咖（超棉+丝印） | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 2167741063610021888 | PCS | PCS | 2167741063610021888 | PCS | PCS | 3000 | 3000 | 3000 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 5 | 2579991369582017538 | 2182903687519762432 | 二十寸纸箱 | YJ-GL-012 | false | false | false | false | true | 44*24.5*53.5 | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 2167741700229872640 | 套 | 套 | 2167741700229872640 | 套 | 套 | 250 | 1000 | 250 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 6 | 2579991369582016515 | 2182903692502596608 | PE袋 | YJ-KBL-012 | false | false | false | false | true | 100*120 | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 1 | 个 | 个 | 1 | 个 | 个 | 800 | 1800 | 800 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 7 | 2579991369582017539 | 2182903692552928256 | 拉伸膜 | YJ-KBL-016 | false | false | false | false | true |  | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 2167741325670189056 | 卷 | 卷 | 2167741325670189056 | 卷 | 卷 | 6 | 6 | 6 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 8 | 2579991369582016516 | 2182903687419100160 | 纸箱 | YJ-GL-003 | false | false | false | false | true | 54.5*28*28.5 | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 1 | 个 | 个 | 1 | 个 | 个 | 180 | 480 | 180 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |

### 金蝶 SCLL-20260930-00009(2026-09-30,C)

| 键 | 值 |
|---|---|
| id | 2579988981731195904 |
| bill_no | SCLL-20260930-00009 |
| bill_date | 2026-09-30 |
| bill_status | C |
| create_time | 2026-09-30 16:56:20 |
| modify_time | 2026-09-30 16:57:34 |
| audit_time | 2026-09-30 16:57:34 |
| creator_id | 425692977 |
| creator_name | 蒋小刚 |
| creator_number | multicorp_6171610_-952599178 |
| modifier_id | 425692977 |
| modifier_name | 蒋小刚 |
| modifier_number | multicorp_6171610_-952599178 |
| bill_type_name | 生产领料单 |
| bill_type_number | inv_pick_bill |
| bill_type_id | inv_pick_bill |
| auditor_id | 425692977 |
| auditor_name | 蒋小刚 |
| auditor_number | multicorp_6171610_-952599178 |
| dept_id | 2170469887338617856 |
| dept_name | 组装车间 |
| dept_number | BM00005 |
| emp_id | 2208993878466477056 |
| emp_name | 周荣香 |
| emp_number | ZY00049 |
| custom_field | [object Object] |
| pick_type | 1 |

material_entity 3 行:

| seq | id | material_id | material_name | material_number | material_is_multi_unit | material_is_serial | material_is_asst_attr | material_is_kf_period | material_is_batch | material_model | stock_id | stock_name | stock_number | stock_is_allow_freight | kf_period | sn_list_id | base_unit_id | base_unit_name | base_unit_number | unit_id | unit_name | unit_number | qty | inv_qty | base_qty | inv_base_qty | aux_qty | def_float_qty | aux_coefficient | coefficient | price | cost | unit_cost | src_inter_id | src_seq | src_entry_id | custom_entity_field | src_product_entry_id | batch_no |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2579988981731194880 | 2512619454605675520 | 55目透明网 | YJ-JPL-067 | false | false | false | false | false | 531±2mm | 2436465656128978944 | 华北工控仓 | CK00006 | false | 0 | 0 | 2167741768244758528 | 条 | 条 | 2167741768244758528 | 条 | 条 | 1900 | 28500 | 1900 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |  |
| 2 | 2579988981731195905 | 2182903686009812992 | 标签 | YJ-CH-022 | false | false | false | false | true | 大咖国际PP标 | 2436465656128978944 | 华北工控仓 | CK00006 | false | 0 | 0 | 2167741887128111104 | 张 | 张 | 2167741887128111104 | 张 | 张 | 2500 | 42500 | 2500 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 | PC0000 |
| 3 | 2579988981731194881 | 2182903687461043200 | 平卡 | YJ-GL-007 | false | false | false | false | true | 36*36 | 2436465656128978944 | 华北工控仓 | CK00006 | false | 0 | 0 | 1 | 个 | 个 | 1 | 个 | 个 | 200 | 1900 | 200 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 | PC0000 |

### 金蝶 SCLL-20260930-00008(2026-09-30,C)

| 键 | 值 |
|---|---|
| id | 2579986826488084480 |
| bill_no | SCLL-20260930-00008 |
| bill_date | 2026-09-30 |
| bill_status | C |
| create_time | 2026-09-30 16:52:14 |
| modify_time | 2026-09-30 16:53:17 |
| audit_time | 2026-09-30 16:53:17 |
| creator_id | 425692977 |
| creator_name | 蒋小刚 |
| creator_number | multicorp_6171610_-952599178 |
| modifier_id | 425692977 |
| modifier_name | 蒋小刚 |
| modifier_number | multicorp_6171610_-952599178 |
| bill_type_name | 生产领料单 |
| bill_type_number | inv_pick_bill |
| bill_type_id | inv_pick_bill |
| auditor_id | 425692977 |
| auditor_name | 蒋小刚 |
| auditor_number | multicorp_6171610_-952599178 |
| dept_id | 2170470111046105088 |
| dept_name | 烧结车间 |
| dept_number | BM00006 |
| emp_id | 2473333400040231936 |
| emp_name | 袁玉洪 |
| emp_number | ZY00108 |
| custom_field | [object Object] |
| pick_type | 1 |

material_entity 2 行:

| seq | id | material_id | material_name | material_number | material_is_multi_unit | material_is_serial | material_is_asst_attr | material_is_kf_period | material_is_batch | stock_id | stock_name | stock_number | stock_is_allow_freight | batch_no | kf_period | sn_list_id | base_unit_id | base_unit_name | base_unit_number | unit_id | unit_name | unit_number | qty | inv_qty | base_qty | inv_base_qty | aux_qty | def_float_qty | aux_coefficient | coefficient | price | cost | unit_cost | src_inter_id | src_seq | src_entry_id | custom_entity_field | src_product_entry_id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2579986826488085504 | 2182904099081648128 | 英克瑞斯酸洗（150-400） | YJ-YKRS-008 | false | false | false | false | true | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 7 | kg | kg | 7 | kg | kg | 1000 | 4425 | 1000 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
| 2 | 2579986826488084481 | 2182903696361356288 | 鑫恒酸洗（80-250） | YJ-XH-002 | false | false | false | false | true | 2436465656128978944 | 华北工控仓 | CK00006 | false | PC0000 | 0 | 0 | 7 | kg | kg | 7 | kg | kg | 1000 | 1000 | 1000 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | [object Object] | 0 |
