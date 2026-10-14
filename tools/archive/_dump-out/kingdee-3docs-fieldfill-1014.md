# 金蝶三类单据:字段非空率统计(只读)

- 账套:惠州市银嘉环保(clientId 359797)
- 每类取样:**30** 张已审核单据的详情
- 口径:非空 = 值不是 ''/null/0/false/空对象;分录键按「任一分录非空」计

## 产品入库单 `inv_product`(MES 面板 `FINISH_IN` 产成品入库单)—— 取样 30 张

### 表头键(30 键,按非空数降序)

| 键 | 非空 / 出现 | 非空率 | 样例值 |
|---|---|---|---|
| `audit_time` | 30 / 30 | 100% | "2026-10-14 18:41:38" |
| `auditor_id` | 30 / 30 | 100% | "425692977" |
| `auditor_name` | 30 / 30 | 100% | "蒋小刚" |
| `auditor_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `bill_date` | 30 / 30 | 100% | "2026-10-14" |
| `bill_no` | 30 / 30 | 100% | "CPRK-20261014-00004" |
| `bill_status` | 30 / 30 | 100% | "C" |
| `bill_type_id` | 30 / 30 | 100% | "inv_product_bill" |
| `bill_type_name` | 30 / 30 | 100% | "产品入库单" |
| `bill_type_number` | 30 / 30 | 100% | "inv_product_bill" |
| `create_time` | 30 / 30 | 100% | "2026-10-14 18:40:46" |
| `creator_id` | 30 / 30 | 100% | "425692977" |
| `creator_name` | 30 / 30 | 100% | "蒋小刚" |
| `creator_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `dept_id` | 30 / 30 | 100% | "2170469887338617856" |
| `dept_name` | 30 / 30 | 100% | "组装车间" |
| `dept_number` | 30 / 30 | 100% | "BM00005" |
| `emp_id` | 30 / 30 | 100% | "2203244138931956736" |
| `emp_name` | 30 / 30 | 100% | "王万华" |
| `id` | 30 / 30 | 100% | "2590188220981525504" |
| `modifier_id` | 30 / 30 | 100% | "425692977" |
| `modifier_name` | 30 / 30 | 100% | "蒋小刚" |
| `modifier_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `modify_time` | 30 / 30 | 100% | "2026-10-14 18:41:38" |
| `emp_number` | 26 / 30 | 87% | "ZY00038" |
| `acceptor_id` | 0 / 30 | 0% |  |
| `acceptor_name` | 0 / 30 | 0% |  |
| `acceptor_number` | 0 / 30 | 0% |  |
| `custom_field` | 0 / 30 | 0% |  |
| `remark` | 0 / 30 | 0% |  |

## 产品入库单 `inv_product`(MES 面板 `FINISH_IN` 产成品入库单)—— 取样 30 张

### 分录键(78 键,按非空数降序)

| 键 | 非空 / 出现 | 非空率 | 样例值 |
|---|---|---|---|
| `base_qty` | 117 / 117 | 100% | 3470 |
| `base_unit_id` | 117 / 117 | 100% | "3" |
| `base_unit_name` | 117 / 117 | 100% | "支" |
| `base_unit_number` | 117 / 117 | 100% | "支" |
| `coefficient` | 117 / 117 | 100% | 1 |
| `id` | 117 / 117 | 100% | "2590188220981629952" |
| `material_id` | 117 / 117 | 100% | "2182903273994943488" |
| `material_name` | 117 / 117 | 100% | "A+级烧结炭棒/滤芯" |
| `material_number` | 117 / 117 | 100% | "D-18-07" |
| `qty` | 117 / 117 | 100% | 3470 |
| `seq` | 117 / 117 | 100% | 1 |
| `stock_id` | 117 / 117 | 100% | "2220441270411712512" |
| `stock_name` | 117 / 117 | 100% | "成品B仓" |
| `stock_number` | 117 / 117 | 100% | "CP-02" |
| `unit_id` | 117 / 117 | 100% | "3" |
| `unit_name` | 117 / 117 | 100% | "支" |
| `unit_number` | 117 / 117 | 100% | "支" |
| `material_model` | 111 / 117 | 95% | "30*12*200" |
| `inv_qty` | 105 / 117 | 90% | 6828 |
| `batch_no` | 78 / 117 | 67% | "PC0000" |
| `material_is_batch` | 78 / 117 | 67% | true |
| `aux_coefficient` | 3 / 117 | 3% | 1000 |
| `aux_qty` | 3 / 117 | 3% | 184 |
| `aux_unit_id` | 3 / 117 | 3% | "7" |
| `aux_unit_name` | 3 / 117 | 3% | "kg" |
| `aux_unit_number` | 3 / 117 | 3% | "kg" |
| `conversion_rate` | 3 / 117 | 3% | "1 kg = 1000 g\n" |
| `material_is_multi_unit` | 3 / 117 | 3% | true |
| `aux_prop_id` | 0 / 117 | 0% |  |
| `aux_prop_name` | 0 / 117 | 0% |  |
| `aux_prop_number` | 0 / 117 | 0% |  |
| `aux1_id` | 0 / 117 | 0% |  |
| `aux1_name` | 0 / 117 | 0% |  |
| `aux1_number` | 0 / 117 | 0% |  |
| `aux2_id` | 0 / 117 | 0% |  |
| `aux2_name` | 0 / 117 | 0% |  |
| `aux2_number` | 0 / 117 | 0% |  |
| `aux3_id` | 0 / 117 | 0% |  |
| `aux3_name` | 0 / 117 | 0% |  |
| `aux3_number` | 0 / 117 | 0% |  |
| `barcode` | 0 / 117 | 0% |  |
| `comment` | 0 / 117 | 0% |  |
| `cost` | 0 / 117 | 0% |  |
| `custom_entity_field` | 0 / 117 | 0% |  |
| `customer_id` | 0 / 117 | 0% |  |
| `customer_name` | 0 / 117 | 0% |  |
| `customer_number` | 0 / 117 | 0% |  |
| `def_float_qty` | 0 / 117 | 0% |  |
| `inv_base_qty` | 0 / 117 | 0% |  |
| `kf_date` | 0 / 117 | 0% |  |
| `kf_period` | 0 / 117 | 0% |  |
| `kf_type` | 0 / 117 | 0% |  |
| `material_is_asst_attr` | 0 / 117 | 0% |  |
| `material_is_kf_period` | 0 / 117 | 0% |  |
| `material_is_serial` | 0 / 117 | 0% |  |
| `picture` | 0 / 117 | 0% |  |
| `price` | 0 / 117 | 0% |  |
| `pro_license` | 0 / 117 | 0% |  |
| `pro_place` | 0 / 117 | 0% |  |
| `pro_reg_no` | 0 / 117 | 0% |  |
| `recv_base_qty` | 0 / 117 | 0% |  |
| `recv_qty` | 0 / 117 | 0% |  |
| `sn_list` | 0 / 117 | 0% |  |
| `sn_list_id` | 0 / 117 | 0% |  |
| `sp_id` | 0 / 117 | 0% |  |
| `sp_name` | 0 / 117 | 0% |  |
| `sp_number` | 0 / 117 | 0% |  |
| `src_bill_date` | 0 / 117 | 0% |  |
| `src_bill_no` | 0 / 117 | 0% |  |
| `src_bill_type_id` | 0 / 117 | 0% |  |
| `src_bill_type_name` | 0 / 117 | 0% |  |
| `src_bill_type_number` | 0 / 117 | 0% |  |
| `src_entry_id` | 0 / 117 | 0% |  |
| `src_inter_id` | 0 / 117 | 0% |  |
| `src_seq` | 0 / 117 | 0% |  |
| `stock_is_allow_freight` | 0 / 117 | 0% |  |
| `unit_cost` | 0 / 117 | 0% |  |
| `valid_date` | 0 / 117 | 0% |  |

## 其他入库单 `inv_other_in`(MES 面板 `OTHER_IN` 其他入库单)—— 取样 30 张

### 表头键(48 键,按非空数降序)

| 键 | 非空 / 出现 | 非空率 | 样例值 |
|---|---|---|---|
| `audit_time` | 30 / 30 | 100% | "2026-10-14 16:47:15" |
| `auditor_id` | 30 / 30 | 100% | "425692977" |
| `auditor_name` | 30 / 30 | 100% | "蒋小刚" |
| `auditor_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `bill_date` | 30 / 30 | 100% | "2026-10-14" |
| `bill_no` | 30 / 30 | 100% | "QTRK-20261014-00092" |
| `bill_status` | 30 / 30 | 100% | "C" |
| `create_time` | 30 / 30 | 100% | "2026-10-14 16:46:53" |
| `creator_id` | 30 / 30 | 100% | "425692977" |
| `creator_name` | 30 / 30 | 100% | "蒋小刚" |
| `creator_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `id` | 30 / 30 | 100% | "2590130656491170816" |
| `modifier_id` | 30 / 30 | 100% | "425692977" |
| `modifier_name` | 30 / 30 | 100% | "蒋小刚" |
| `modifier_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `modify_time` | 30 / 30 | 100% | "2026-10-14 16:47:16" |
| `supplier_id` | 30 / 30 | 100% | "2241285519952694272" |
| `supplier_name` | 30 / 30 | 100% | "KG" |
| `supplier_number` | 30 / 30 | 100% | "GYS00014" |
| `trans_type_id` | 30 / 30 | 100% | "12" |
| `trans_type_name` | 30 / 30 | 100% | "其他入库" |
| `trans_type_number` | 30 / 30 | 100% | "QTRKLX01" |
| `contact_address` | 0 / 30 | 0% |  |
| `contact_city` | 0 / 30 | 0% |  |
| `contact_city_id` | 0 / 30 | 0% |  |
| `contact_city_name` | 0 / 30 | 0% |  |
| `contact_city_number` | 0 / 30 | 0% |  |
| `contact_country_id` | 0 / 30 | 0% |  |
| `contact_country_name` | 0 / 30 | 0% |  |
| `contact_country_number` | 0 / 30 | 0% |  |
| `contact_district_id` | 0 / 30 | 0% |  |
| `contact_district_name` | 0 / 30 | 0% |  |
| `contact_district_number` | 0 / 30 | 0% |  |
| `contact_phone` | 0 / 30 | 0% |  |
| `contact_province_id` | 0 / 30 | 0% |  |
| `contact_province_name` | 0 / 30 | 0% |  |
| `contact_province_number` | 0 / 30 | 0% |  |
| `custom_field` | 0 / 30 | 0% |  |
| `customer_id` | 0 / 30 | 0% |  |
| `customer_name` | 0 / 30 | 0% |  |
| `customer_number` | 0 / 30 | 0% |  |
| `dept_id` | 0 / 30 | 0% |  |
| `dept_name` | 0 / 30 | 0% |  |
| `dept_number` | 0 / 30 | 0% |  |
| `emp_id` | 0 / 30 | 0% |  |
| `emp_name` | 0 / 30 | 0% |  |
| `emp_number` | 0 / 30 | 0% |  |
| `remark` | 0 / 30 | 0% |  |

## 其他入库单 `inv_other_in`(MES 面板 `OTHER_IN` 其他入库单)—— 取样 30 张

### 分录键(73 键,按非空数降序)

| 键 | 非空 / 出现 | 非空率 | 样例值 |
|---|---|---|---|
| `base_qty` | 37 / 37 | 100% | 1050 |
| `base_unit_id` | 37 / 37 | 100% | "2167741887128111104" |
| `base_unit_name` | 37 / 37 | 100% | "张" |
| `base_unit_number` | 37 / 37 | 100% | "张" |
| `coefficient` | 37 / 37 | 100% | 1 |
| `id` | 37 / 37 | 100% | "2590130656491169792" |
| `material_id` | 37 / 37 | 100% | "2305923234782023680" |
| `material_name` | 37 / 37 | 100% | "客供标签" |
| `material_number` | 37 / 37 | 100% | "YJ-KG-B12" |
| `qty` | 37 / 37 | 100% | 1050 |
| `seq` | 37 / 37 | 100% | 1 |
| `stock_id` | 37 / 37 | 100% | "2436465656128978944" |
| `stock_name` | 37 / 37 | 100% | "华北工控仓" |
| `stock_number` | 37 / 37 | 100% | "CK00006" |
| `unit_id` | 37 / 37 | 100% | "2167741887128111104" |
| `unit_name` | 37 / 37 | 100% | "张" |
| `unit_number` | 37 / 37 | 100% | "张" |
| `material_model` | 31 / 37 | 84% | "乐天鹅标B-46-14" |
| `inv_qty` | 8 / 37 | 22% | 45 |
| `cost` | 7 / 37 | 19% | 135.19 |
| `unit_cost` | 7 / 37 | 19% | 0.055 |
| `picture` | 5 / 37 | 14% | "https://v7-oss.oss-cn-hangzhou.aliyuncs.com/jdyattachmentimage/1735565918201383 |
| `aux_coefficient` | 1 / 37 | 3% | 1000 |
| `aux_qty` | 1 / 37 | 3% | 80 |
| `aux_unit_id` | 1 / 37 | 3% | "7" |
| `aux_unit_name` | 1 / 37 | 3% | "kg" |
| `aux_unit_number` | 1 / 37 | 3% | "kg" |
| `conversion_rate` | 1 / 37 | 3% | "1 kg = 1000 g\n" |
| `material_is_multi_unit` | 1 / 37 | 3% | true |
| `aux_id1` | 0 / 37 | 0% |  |
| `aux_id2` | 0 / 37 | 0% |  |
| `aux_id3` | 0 / 37 | 0% |  |
| `aux_name1` | 0 / 37 | 0% |  |
| `aux_name2` | 0 / 37 | 0% |  |
| `aux_name3` | 0 / 37 | 0% |  |
| `aux_number1` | 0 / 37 | 0% |  |
| `aux_number2` | 0 / 37 | 0% |  |
| `aux_number3` | 0 / 37 | 0% |  |
| `aux_prop_id` | 0 / 37 | 0% |  |
| `aux_prop_name` | 0 / 37 | 0% |  |
| `aux_prop_number` | 0 / 37 | 0% |  |
| `barcode` | 0 / 37 | 0% |  |
| `batch_no` | 0 / 37 | 0% |  |
| `comment` | 0 / 37 | 0% |  |
| `custom_entity_field` | 0 / 37 | 0% |  |
| `def_float_qty` | 0 / 37 | 0% |  |
| `inv_base_qty` | 0 / 37 | 0% |  |
| `kf_date` | 0 / 37 | 0% |  |
| `kf_period` | 0 / 37 | 0% |  |
| `kf_type` | 0 / 37 | 0% |  |
| `material_is_asst_attr` | 0 / 37 | 0% |  |
| `material_is_batch` | 0 / 37 | 0% |  |
| `material_is_kf_period` | 0 / 37 | 0% |  |
| `material_is_serial` | 0 / 37 | 0% |  |
| `price` | 0 / 37 | 0% |  |
| `pro_license` | 0 / 37 | 0% |  |
| `pro_place` | 0 / 37 | 0% |  |
| `pro_reg_no` | 0 / 37 | 0% |  |
| `sn_list` | 0 / 37 | 0% |  |
| `sn_list_id` | 0 / 37 | 0% |  |
| `sp_id` | 0 / 37 | 0% |  |
| `sp_name` | 0 / 37 | 0% |  |
| `sp_number` | 0 / 37 | 0% |  |
| `src_bill_date` | 0 / 37 | 0% |  |
| `src_bill_no` | 0 / 37 | 0% |  |
| `src_bill_type_id` | 0 / 37 | 0% |  |
| `src_bill_type_name` | 0 / 37 | 0% |  |
| `src_bill_type_number` | 0 / 37 | 0% |  |
| `src_entry_id` | 0 / 37 | 0% |  |
| `src_inter_id` | 0 / 37 | 0% |  |
| `src_seq` | 0 / 37 | 0% |  |
| `stock_is_allow_freight` | 0 / 37 | 0% |  |
| `valid_date` | 0 / 37 | 0% |  |

## 其他出库单 `inv_other_out`(MES 面板 `OTHER_OUT` 其他出库单)—— 取样 30 张

### 表头键(45 键,按非空数降序)

| 键 | 非空 / 出现 | 非空率 | 样例值 |
|---|---|---|---|
| `audit_time` | 30 / 30 | 100% | "2026-10-14 14:11:34" |
| `auditor_id` | 30 / 30 | 100% | "425692977" |
| `auditor_name` | 30 / 30 | 100% | "蒋小刚" |
| `auditor_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `bill_date` | 30 / 30 | 100% | "2026-10-14" |
| `bill_no` | 30 / 30 | 100% | "QTCK-20261014-01172" |
| `bill_status` | 30 / 30 | 100% | "C" |
| `create_time` | 30 / 30 | 100% | "2026-10-14 14:10:53" |
| `creator_id` | 30 / 30 | 100% | "425692977" |
| `creator_name` | 30 / 30 | 100% | "蒋小刚" |
| `creator_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `id` | 30 / 30 | 100% | "2590052297648318464" |
| `modifier_id` | 30 / 30 | 100% | "425692977" |
| `modifier_name` | 30 / 30 | 100% | "蒋小刚" |
| `modifier_number` | 30 / 30 | 100% | "multicorp_6171610_-952599178" |
| `modify_time` | 30 / 30 | 100% | "2026-10-14 14:11:34" |
| `trans_type_id` | 30 / 30 | 100% | "13" |
| `trans_type_name` | 30 / 30 | 100% | "其他出库" |
| `trans_type_number` | 30 / 30 | 100% | "QTCKLX01" |
| `dept_id` | 29 / 30 | 97% | "2259481876848820224" |
| `dept_name` | 29 / 30 | 97% | "品质部" |
| `dept_number` | 29 / 30 | 97% | "BM00022" |
| `emp_id` | 29 / 30 | 97% | "2210981295260037120" |
| `emp_name` | 29 / 30 | 97% | "冯敏" |
| `emp_number` | 29 / 30 | 97% | "ZY00053" |
| `contact_address` | 0 / 30 | 0% |  |
| `contact_city_id` | 0 / 30 | 0% |  |
| `contact_city_name` | 0 / 30 | 0% |  |
| `contact_city_number` | 0 / 30 | 0% |  |
| `contact_country_id` | 0 / 30 | 0% |  |
| `contact_country_name` | 0 / 30 | 0% |  |
| `contact_country_number` | 0 / 30 | 0% |  |
| `contact_district_id` | 0 / 30 | 0% |  |
| `contact_district_name` | 0 / 30 | 0% |  |
| `contact_district_number` | 0 / 30 | 0% |  |
| `contact_linkman` | 0 / 30 | 0% |  |
| `contact_phone` | 0 / 30 | 0% |  |
| `contact_province_id` | 0 / 30 | 0% |  |
| `contact_province_name` | 0 / 30 | 0% |  |
| `contact_province_number` | 0 / 30 | 0% |  |
| `custom_field` | 0 / 30 | 0% |  |
| `customer_id` | 0 / 30 | 0% |  |
| `customer_name` | 0 / 30 | 0% |  |
| `customer_number` | 0 / 30 | 0% |  |
| `remark` | 0 / 30 | 0% |  |

## 其他出库单 `inv_other_out`(MES 面板 `OTHER_OUT` 其他出库单)—— 取样 30 张

### 分录键(73 键,按非空数降序)

| 键 | 非空 / 出现 | 非空率 | 样例值 |
|---|---|---|---|
| `base_qty` | 41 / 41 | 100% | 2 |
| `base_unit_id` | 41 / 41 | 100% | "3" |
| `base_unit_name` | 41 / 41 | 100% | "支" |
| `base_unit_number` | 41 / 41 | 100% | "支" |
| `coefficient` | 41 / 41 | 100% | 1 |
| `id` | 41 / 41 | 100% | "2590052297648319488" |
| `inv_qty` | 41 / 41 | 100% | 1549 |
| `material_id` | 41 / 41 | 100% | "2182903275429394432" |
| `material_name` | 41 / 41 | 100% | "A+级烧结炭棒/滤芯" |
| `material_number` | 41 / 41 | 100% | "S062" |
| `qty` | 41 / 41 | 100% | 2 |
| `seq` | 41 / 41 | 100% | 1 |
| `stock_id` | 41 / 41 | 100% | "2220441270411712512" |
| `stock_name` | 41 / 41 | 100% | "成品B仓" |
| `stock_number` | 41 / 41 | 100% | "CP-02" |
| `unit_id` | 41 / 41 | 100% | "3" |
| `unit_name` | 41 / 41 | 100% | "支" |
| `unit_number` | 41 / 41 | 100% | "支" |
| `batch_no` | 38 / 41 | 93% | "PC0000" |
| `material_is_batch` | 38 / 41 | 93% | true |
| `material_model` | 37 / 41 | 90% | "63*40*242.5" |
| `aux_coefficient` | 0 / 41 | 0% |  |
| `aux_id1` | 0 / 41 | 0% |  |
| `aux_id2` | 0 / 41 | 0% |  |
| `aux_id3` | 0 / 41 | 0% |  |
| `aux_name1` | 0 / 41 | 0% |  |
| `aux_name2` | 0 / 41 | 0% |  |
| `aux_name3` | 0 / 41 | 0% |  |
| `aux_number1` | 0 / 41 | 0% |  |
| `aux_number2` | 0 / 41 | 0% |  |
| `aux_number3` | 0 / 41 | 0% |  |
| `aux_prop_id` | 0 / 41 | 0% |  |
| `aux_prop_name` | 0 / 41 | 0% |  |
| `aux_prop_number` | 0 / 41 | 0% |  |
| `aux_qty` | 0 / 41 | 0% |  |
| `aux_unit_id` | 0 / 41 | 0% |  |
| `aux_unit_name` | 0 / 41 | 0% |  |
| `aux_unit_number` | 0 / 41 | 0% |  |
| `barcode` | 0 / 41 | 0% |  |
| `comment` | 0 / 41 | 0% |  |
| `conversion_rate` | 0 / 41 | 0% |  |
| `cost` | 0 / 41 | 0% |  |
| `custom_entity_field` | 0 / 41 | 0% |  |
| `def_float_qty` | 0 / 41 | 0% |  |
| `inv_base_qty` | 0 / 41 | 0% |  |
| `kf_date` | 0 / 41 | 0% |  |
| `kf_period` | 0 / 41 | 0% |  |
| `kf_type` | 0 / 41 | 0% |  |
| `material_is_asst_attr` | 0 / 41 | 0% |  |
| `material_is_kf_period` | 0 / 41 | 0% |  |
| `material_is_multi_unit` | 0 / 41 | 0% |  |
| `material_is_serial` | 0 / 41 | 0% |  |
| `picture` | 0 / 41 | 0% |  |
| `price` | 0 / 41 | 0% |  |
| `pro_license` | 0 / 41 | 0% |  |
| `pro_place` | 0 / 41 | 0% |  |
| `pro_reg_no` | 0 / 41 | 0% |  |
| `sn_list` | 0 / 41 | 0% |  |
| `sn_list_id` | 0 / 41 | 0% |  |
| `sp_id` | 0 / 41 | 0% |  |
| `sp_name` | 0 / 41 | 0% |  |
| `sp_number` | 0 / 41 | 0% |  |
| `src_bill_date` | 0 / 41 | 0% |  |
| `src_bill_no` | 0 / 41 | 0% |  |
| `src_bill_type_id` | 0 / 41 | 0% |  |
| `src_bill_type_name` | 0 / 41 | 0% |  |
| `src_bill_type_number` | 0 / 41 | 0% |  |
| `src_entry_id` | 0 / 41 | 0% |  |
| `src_inter_id` | 0 / 41 | 0% |  |
| `src_seq` | 0 / 41 | 0% |  |
| `stock_is_allow_freight` | 0 / 41 | 0% |  |
| `unit_cost` | 0 / 41 | 0% |  |
| `valid_date` | 0 / 41 | 0% |  |
