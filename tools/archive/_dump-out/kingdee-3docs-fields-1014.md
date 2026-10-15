# 金蝶星辰:出入库单据接口字段清单(只读 dump)

- 账套:惠州市银嘉环保科技有限公司(outerInstanceId 580147507460444160,clientId 359797)
- 抓取时间:2026-10-14T10:41:38.419Z
- 说明:表头键 = 详情接口顶层键;分录键 = `material_entity` 首条分录的键;样例值取自账套内**最新一张已审核单据**。

## 产品入库单 — 金蝶接口 `/jdy/v2/scm/inv_product`(MES 面板 `FINISH_IN` 产成品入库单)

- 账套内条数(已审核):**2881**;本清单取样单号:`CPRK-20261014-00004`(2026-10-14),分录 2 行
- 表头键 **31** 个 / 分录键 **78** 个

### 表头(键 = 值)

| 键 | 样例值 |
|---|---|
| id | "2590188220981525504" |
| bill_no | "CPRK-20261014-00004" |
| bill_date | "2026-10-14" |
| bill_status | "C" |
| create_time | "2026-10-14 18:40:46" |
| modify_time | "2026-10-14 18:41:38" |
| audit_time | "2026-10-14 18:41:38" |
| creator_id | "425692977" |
| creator_name | "蒋小刚" |
| creator_number | "multicorp_6171610_-952599178" |
| modifier_id | "425692977" |
| modifier_name | "蒋小刚" |
| modifier_number | "multicorp_6171610_-952599178" |
| bill_type_name | "产品入库单" |
| bill_type_number | "inv_product_bill" |
| bill_type_id | "inv_product_bill" |
| auditor_id | "425692977" |
| auditor_name | "蒋小刚" |
| auditor_number | "multicorp_6171610_-952599178" |
| remark | "" |
| dept_id | "2170469887338617856" |
| dept_name | "组装车间" |
| dept_number | "BM00005" |
| emp_id | "2203244138931956736" |
| emp_name | "王万华" |
| emp_number | "ZY00038" |
| material_entity | (分录 2 行,见下) |
| custom_field | {} |
| acceptor_id | "" |
| acceptor_name | "" |
| acceptor_number | "" |

### 分录(首条)

| 键 | 样例值 |
|---|---|
| picture | "" |
| seq | 1 |
| id | "2590188220981629952" |
| material_id | "2182903273994943488" |
| material_name | "A+级烧结炭棒/滤芯" |
| material_number | "D-18-07" |
| material_is_multi_unit | false |
| material_is_serial | false |
| material_is_asst_attr | false |
| material_is_kf_period | false |
| material_is_batch | true |
| material_model | "30*12*200" |
| stock_id | "2220441270411712512" |
| stock_name | "成品B仓" |
| stock_number | "CP-02" |
| stock_is_allow_freight | false |
| sp_id | "" |
| sp_name | "" |
| sp_number | "" |
| aux_prop_id | "" |
| aux_prop_name | "" |
| aux_prop_number | "" |
| aux1_id | "" |
| aux1_name | "" |
| aux1_number | "" |
| aux2_id | "" |
| aux2_name | "" |
| aux2_number | "" |
| aux3_id | "" |
| aux3_name | "" |
| aux3_number | "" |
| barcode | "" |
| batch_no | "PC0000" |
| pro_place | "" |
| pro_reg_no | "" |
| pro_license | "" |
| kf_date | "" |
| valid_date | "" |
| kf_type | "" |
| kf_period | 0 |
| sn_list | "" |
| sn_list_id | "0" |
| base_unit_id | "3" |
| base_unit_name | "支" |
| base_unit_number | "支" |
| unit_id | "3" |
| unit_name | "支" |
| unit_number | "支" |
| aux_unit_id | "" |
| aux_unit_name | "" |
| aux_unit_number | "" |
| conversion_rate | "" |
| qty | 3470 |
| inv_qty | 6828 |
| base_qty | 3470 |
| inv_base_qty | 0 |
| aux_qty | 0 |
| def_float_qty | 0 |
| aux_coefficient | 0 |
| coefficient | 1 |
| price | 0 |
| cost | 0 |
| unit_cost | 0 |
| comment | "" |
| src_bill_no | "" |
| src_bill_type_id | "" |
| src_bill_type_name | "" |
| src_bill_type_number | "" |
| src_inter_id | "0" |
| src_bill_date | "" |
| src_seq | "0" |
| src_entry_id | "0" |
| custom_entity_field | {} |
| recv_qty | "0" |
| recv_base_qty | "0" |
| customer_id | "" |
| customer_number | "" |
| customer_name | "" |

## 其他入库单 — 金蝶接口 `/jdy/v2/scm/inv_other_in`(MES 面板 `OTHER_IN` 其他入库单)

- 账套内条数(已审核):**81**;本清单取样单号:`QTRK-20261014-00092`(2026-10-14),分录 1 行
- 表头键 **49** 个 / 分录键 **73** 个

### 表头(键 = 值)

| 键 | 样例值 |
|---|---|
| id | "2590130656491170816" |
| bill_no | "QTRK-20261014-00092" |
| bill_date | "2026-10-14" |
| bill_status | "C" |
| create_time | "2026-10-14 16:46:53" |
| modify_time | "2026-10-14 16:47:16" |
| audit_time | "2026-10-14 16:47:15" |
| creator_id | "425692977" |
| creator_name | "蒋小刚" |
| creator_number | "multicorp_6171610_-952599178" |
| modifier_id | "425692977" |
| modifier_name | "蒋小刚" |
| modifier_number | "multicorp_6171610_-952599178" |
| auditor_id | "425692977" |
| auditor_name | "蒋小刚" |
| auditor_number | "multicorp_6171610_-952599178" |
| trans_type_id | "12" |
| trans_type_name | "其他入库" |
| trans_type_number | "QTRKLX01" |
| customer_id | "" |
| customer_name | "" |
| customer_number | "" |
| supplier_id | "2241285519952694272" |
| supplier_name | "KG" |
| supplier_number | "GYS00014" |
| remark | "" |
| dept_id | "" |
| dept_name | "" |
| dept_number | "" |
| emp_id | "" |
| emp_name | "" |
| emp_number | "" |
| contact_phone | "" |
| contact_city | "" |
| contact_country_id | "" |
| contact_country_name | "" |
| contact_country_number | "" |
| contact_province_id | "" |
| contact_province_name | "" |
| contact_province_number | "" |
| contact_city_id | "" |
| contact_city_name | "" |
| contact_city_number | "" |
| contact_district_id | "" |
| contact_district_name | "" |
| contact_district_number | "" |
| contact_address | "" |
| material_entity | (分录 1 行,见下) |
| custom_field | {} |

### 分录(首条)

| 键 | 样例值 |
|---|---|
| picture | "" |
| seq | 1 |
| id | "2590130656491169792" |
| material_id | "2305923234782023680" |
| material_name | "客供标签" |
| material_number | "YJ-KG-B12" |
| material_is_multi_unit | false |
| material_is_serial | false |
| material_is_asst_attr | false |
| material_is_kf_period | false |
| material_is_batch | false |
| material_model | "乐天鹅标B-46-14" |
| stock_id | "2436465656128978944" |
| stock_name | "华北工控仓" |
| stock_number | "CK00006" |
| stock_is_allow_freight | false |
| sp_id | "" |
| sp_name | "" |
| sp_number | "" |
| aux_prop_id | "" |
| aux_prop_name | "" |
| aux_prop_number | "" |
| aux_id1 | "" |
| aux_name1 | "" |
| aux_number1 | "" |
| aux_id2 | "" |
| aux_name2 | "" |
| aux_number2 | "" |
| aux_id3 | "" |
| aux_name3 | "" |
| aux_number3 | "" |
| barcode | "" |
| batch_no | "" |
| pro_place | "" |
| pro_reg_no | "" |
| pro_license | "" |
| kf_date | "" |
| valid_date | "" |
| kf_type | "" |
| kf_period | 0 |
| sn_list | "" |
| sn_list_id | "0" |
| base_unit_id | "2167741887128111104" |
| base_unit_name | "张" |
| base_unit_number | "张" |
| unit_id | "2167741887128111104" |
| unit_name | "张" |
| unit_number | "张" |
| aux_unit_id | "" |
| aux_unit_name | "" |
| aux_unit_number | "" |
| conversion_rate | "" |
| qty | 1050 |
| inv_qty | 0 |
| base_qty | 1050 |
| inv_base_qty | 0 |
| aux_qty | 0 |
| def_float_qty | 0 |
| aux_coefficient | 0 |
| coefficient | 1 |
| price | 0 |
| cost | 0 |
| unit_cost | 0 |
| comment | "" |
| src_bill_no | "" |
| src_bill_type_id | "" |
| src_bill_type_name | "" |
| src_bill_type_number | "" |
| src_inter_id | "0" |
| src_bill_date | "" |
| src_seq | "0" |
| src_entry_id | "0" |
| custom_entity_field | {} |

## 其他出库单 — 金蝶接口 `/jdy/v2/scm/inv_other_out`(MES 面板 `OTHER_OUT` 其他出库单)

- 账套内条数(已审核):**1149**;本清单取样单号:`QTCK-20261014-01172`(2026-10-14),分录 1 行
- 表头键 **46** 个 / 分录键 **73** 个

### 表头(键 = 值)

| 键 | 样例值 |
|---|---|
| id | "2590052297648318464" |
| bill_no | "QTCK-20261014-01172" |
| bill_date | "2026-10-14" |
| bill_status | "C" |
| create_time | "2026-10-14 14:10:53" |
| modify_time | "2026-10-14 14:11:34" |
| audit_time | "2026-10-14 14:11:34" |
| creator_id | "425692977" |
| creator_name | "蒋小刚" |
| creator_number | "multicorp_6171610_-952599178" |
| modifier_id | "425692977" |
| modifier_name | "蒋小刚" |
| modifier_number | "multicorp_6171610_-952599178" |
| auditor_id | "425692977" |
| auditor_name | "蒋小刚" |
| auditor_number | "multicorp_6171610_-952599178" |
| trans_type_id | "13" |
| trans_type_name | "其他出库" |
| trans_type_number | "QTCKLX01" |
| customer_id | "" |
| customer_name | "" |
| customer_number | "" |
| remark | "" |
| dept_id | "2259481876848820224" |
| dept_name | "品质部" |
| dept_number | "BM00022" |
| emp_id | "2210981295260037120" |
| emp_name | "冯敏" |
| emp_number | "ZY00053" |
| contact_phone | "" |
| contact_country_id | "" |
| contact_country_name | "" |
| contact_country_number | "" |
| contact_province_id | "" |
| contact_province_name | "" |
| contact_province_number | "" |
| contact_city_id | "" |
| contact_city_name | "" |
| contact_city_number | "" |
| contact_district_id | "" |
| contact_district_name | "" |
| contact_linkman | "" |
| contact_district_number | "" |
| contact_address | "" |
| material_entity | (分录 1 行,见下) |
| custom_field | {} |

### 分录(首条)

| 键 | 样例值 |
|---|---|
| picture | "" |
| seq | 1 |
| id | "2590052297648319488" |
| material_id | "2182903275429394432" |
| material_name | "A+级烧结炭棒/滤芯" |
| material_number | "S062" |
| material_is_multi_unit | false |
| material_is_serial | false |
| material_is_asst_attr | false |
| material_is_kf_period | false |
| material_is_batch | true |
| material_model | "63*40*242.5" |
| stock_id | "2220441270411712512" |
| stock_name | "成品B仓" |
| stock_number | "CP-02" |
| stock_is_allow_freight | false |
| sp_id | "" |
| sp_name | "" |
| sp_number | "" |
| aux_prop_id | "" |
| aux_prop_name | "" |
| aux_prop_number | "" |
| aux_id1 | "" |
| aux_name1 | "" |
| aux_number1 | "" |
| aux_id2 | "" |
| aux_name2 | "" |
| aux_number2 | "" |
| aux_id3 | "" |
| aux_name3 | "" |
| aux_number3 | "" |
| barcode | "" |
| batch_no | "PC0000" |
| pro_place | "" |
| pro_reg_no | "" |
| pro_license | "" |
| kf_date | "" |
| valid_date | "" |
| kf_type | "" |
| kf_period | 0 |
| sn_list | "" |
| sn_list_id | "0" |
| base_unit_id | "3" |
| base_unit_name | "支" |
| base_unit_number | "支" |
| unit_id | "3" |
| unit_name | "支" |
| unit_number | "支" |
| aux_unit_id | "" |
| aux_unit_name | "" |
| aux_unit_number | "" |
| conversion_rate | "" |
| qty | 2 |
| inv_qty | 1549 |
| base_qty | 2 |
| inv_base_qty | 0 |
| aux_qty | 0 |
| def_float_qty | 0 |
| aux_coefficient | 0 |
| coefficient | 1 |
| price | 0 |
| cost | 0 |
| unit_cost | 0 |
| comment | "" |
| src_bill_no | "" |
| src_bill_type_id | "" |
| src_bill_type_name | "" |
| src_bill_type_number | "" |
| src_inter_id | "0" |
| src_bill_date | "" |
| src_seq | "0" |
| src_entry_id | "0" |
| custom_entity_field | {} |

## 采购入库单 — 金蝶接口 `/jdy/v2/scm/pur_inbound`(MES 面板 `PURCHASE_IN` 采购入库单)

- 账套内条数(已审核):**3382**;本清单取样单号:`CGRK-20261013-03415`(2026-10-13),分录 2 行
- 表头键 **92** 个 / 分录键 **83** 个

### 表头(键 = 值)

| 键 | 样例值 |
|---|---|
| id | "2590140672724118528" |
| bill_no | "CGRK-20261013-03415" |
| bill_date | "2026-10-13" |
| bill_status | "C" |
| create_time | "2026-10-14 17:06:11" |
| modify_time | "2026-10-14 17:07:10" |
| audit_time | "2026-10-14 17:07:09" |
| creator_id | "425692977" |
| creator_name | "蒋小刚" |
| creator_number | "multicorp_6171610_-952599178" |
| modifier_id | "425692977" |
| modifier_name | "蒋小刚" |
| modifier_number | "multicorp_6171610_-952599178" |
| auditor_id | "425692977" |
| auditor_name | "蒋小刚" |
| auditor_number | "multicorp_6171610_-952599178" |
| trans_type | "2" |
| remark | "" |
| dept_id | "2158093503018659840" |
| dept_name | "采购部" |
| dept_number | "BM00002" |
| emp_id | "2183434422324416512" |
| emp_name | "王光珍" |
| emp_number | "ZY00018" |
| customer_id | "" |
| customer_name | "" |
| customer_number | "" |
| supplier_id | "2158089910479760384" |
| supplier_name | "惠州市双喜科技有限公司" |
| supplier_number | "YJ-SX" |
| contact_phone | "trSB49wO4YnOy4okgIYGYg==" |
| contact_country_id | "" |
| contact_country_name | "" |
| contact_country_number | "" |
| contact_province_id | "" |
| contact_province_name | "" |
| contact_province_number | "" |
| contact_city_id | "" |
| contact_city_name | "" |
| contact_city_number | "" |
| contact_district_id | "" |
| contact_district_name | "" |
| contact_district_number | "" |
| contact_address | "" |
| total_unsettle_amount | 6215 |
| total_unsettle_amount_for | 0 |
| exchange_rate | 1 |
| settle_status | "A" |
| all_debt | 3147708.86 |
| last_debt | 3141493.86 |
| total_amount | 6215 |
| edit_pay_type_id | "" |
| edit_pay_type_name | "" |
| edit_pay_type_number | "" |
| total_pre_amount | 0 |
| bill_dis_amount | 0 |
| edit_pay_account_id | "" |
| edit_pay_account_name | "" |
| edit_pay_account_number | "" |
| bill_dis_rate | 0 |
| total_ins_amount | 0 |
| material_entity | (分录 2 行,见下) |
| custom_field | {} |
| currency_id | "100000" |
| due_date | "2026-10-13" |
| setting_term_id | "" |
| setting_term_number | "" |
| setting_term_name | "" |
| dispatcher_linkman | "" |
| dispatcher_phone | "" |
| dispatcher_address | "" |
| dispatcher_country_id | "1000001" |
| dispatcher_country_name | "中国" |
| dispatcher_country_number | "001" |
| dispatcher_province_id | "" |
| dispatcher_province_name | "" |
| dispatcher_province_number | "" |
| dispatcher_city_id | "" |
| dispatcher_city_name | "" |
| dispatcher_city_number | "" |
| dispatcher_district_id | "" |
| dispatcher_district_name | "" |
| dispatcher_district_number | "" |
| cost_fee_entity | null |
| payment_entry | [] |
| attachments_url | [] |
| bill_stock_id | "" |
| bill_stock_name | "" |
| bill_stock_number | "" |
| bill_sp_id | "" |
| bill_sp_name | "" |
| bill_sp_number | "" |

### 分录(首条)

| 键 | 样例值 |
|---|---|
| picture | "" |
| seq | 1 |
| id | "2590140672950609922" |
| material_id | "2184983164051613696" |
| material_name | "端盖" |
| material_number | "YJ-SX-034" |
| material_is_multi_unit | false |
| material_is_serial | false |
| material_is_asst_attr | false |
| material_is_kf_period | false |
| material_is_batch | true |
| material_model | "灰色大咖（超棉+丝印）" |
| stock_id | "2436465656128978944" |
| stock_name | "华北工控仓" |
| stock_number | "CK00006" |
| stock_is_allow_freight | false |
| sp_id | "" |
| sp_name | "" |
| sp_number | "" |
| aux_prop_id | "" |
| aux_prop_name | "" |
| aux_prop_number | "" |
| aux_id1 | "" |
| aux_name1 | "" |
| aux_number1 | "" |
| aux_id2 | "" |
| aux_name2 | "" |
| aux_number2 | "" |
| aux_id3 | "" |
| aux_name3 | "" |
| aux_number3 | "" |
| barcode | "" |
| batch_no | "PC0000" |
| pro_place | "" |
| pro_reg_no | "" |
| pro_license | "" |
| kf_date | "" |
| valid_date | "" |
| kf_type | "" |
| kf_period | 0 |
| sn_list | "" |
| sn_list_id | "0" |
| base_unit_id | "2167741063610021888" |
| base_unit_name | "PCS" |
| base_unit_number | "PCS" |
| unit_id | "2167741063610021888" |
| unit_name | "PCS" |
| unit_number | "PCS" |
| aux_unit_id | "" |
| aux_unit_name | "" |
| aux_unit_number | "" |
| conversion_rate | "" |
| qty | 8100 |
| inv_qty | 0 |
| base_qty | 8100 |
| inv_base_qty | 0 |
| aux_qty | 0 |
| def_float_qty | 0 |
| aux_coefficient | 0 |
| coefficient | 1 |
| price | 0.55 |
| discount | 10 |
| comment | "" |
| src_bill_no | "YJ-20260919-04" |
| src_bill_type_id | "pur_bill_order" |
| src_bill_type_name | "采购订单" |
| src_bill_type_number | "pur_bill_order" |
| src_inter_id | "2571971845502932992" |
| src_bill_date | "" |
| src_seq | 1 |
| src_entry_id | "2571971845502934016" |
| entry_settle_status | "A" |
| cur_settle_amount_for | "0" |
| dis_rate | 0 |
| cess | 0 |
| cost_view | 4455 |
| unit_cost_view | 0 |
| custom_entity_field | {} |
| tax_price | 0.55 |
| all_amount | 4455 |
| return_qty | 0 |
| all_amount_for | "4455" |
| is_free | false |

## 销售出库单 — 金蝶接口 `/jdy/v2/scm/sal_out_bound`(MES 面板 `SALE_OUT` 销售出库单)

- 账套内条数(已审核):**5209**;本清单取样单号:`XSCK-20261014-00008`(2026-10-14),分录 1 行
- 表头键 **90** 个 / 分录键 **107** 个

### 表头(键 = 值)

| 键 | 样例值 |
|---|---|
| id | "2590046101084138496" |
| bill_no | "XSCK-20261014-00008" |
| contact_phone | "" |
| contact_country_id | "" |
| contact_country_name | "" |
| contact_country_number | "" |
| contact_province_id | "" |
| contact_province_name | "" |
| contact_province_number | "" |
| contact_city_id | "" |
| contact_city_name | "" |
| contact_city_number | "" |
| contact_district_id | "" |
| contact_district_name | "" |
| contact_district_number | "" |
| contact_linkman | "" |
| contact_info | "" |
| contact_address | "" |
| dispatcher_country_id | "1000001" |
| dispatcher_country_name | "中国" |
| dispatcher_country_number | "001" |
| dispatcher_province_id | "" |
| dispatcher_province_name | "" |
| dispatcher_province_number | "" |
| dispatcher_city_id | "" |
| dispatcher_city_name | "" |
| dispatcher_city_number | "" |
| dispatcher_district_id | "" |
| dispatcher_district_name | "" |
| dispatcher_district_number | "" |
| dispatcher_address | "" |
| dispatcher_linkman | "" |
| dispatcher_phone | "" |
| recevice_delivery | "" |
| payment_entry | [{"id":"2590153679378147328","settle_account_id":"2174157751201131520","settle_account_name":"支付宝刘学仁","pay_amount":"1500","pay_type_id":"4","pay_type_ |
| deduction_balance | 0 |
| total_un_settle_amount | 0 |
| attachments | 0 |
| attachments_url | [] |
| auditor_id | "425692833" |
| auditor_name | "叶健乐" |
| auditor_number | "multicorp_6171610_1161291713" |
| audit_time | "2026-10-14 17:33:03" |
| all_debt | 386975.7 |
| f_logistics_id | 0 |
| cost_fee | 0 |
| emp_id | "2157416879046617088" |
| emp_name | "张莉" |
| emp_number | "ZL" |
| subsist_info | 1000 |
| last_debt | 386975.7 |
| bill_status | "C" |
| trans_type | "2" |
| material_entity | (分录 1 行,见下) |
| total_amount | 1500 |
| bill_date | "2026-10-14" |
| customer_id | "2157964397929049088" |
| bill_dis_amount | 0 |
| dept_id | "2157415425770612736" |
| dept_name | "销售部" |
| dept_number | "BM00001" |
| remark | "" |
| bill_dis_rate | 0 |
| create_time | "2026-10-14 13:59:15" |
| modify_time | "2026-10-14 17:33:03" |
| io_status | "0" |
| creator_id | "425692977" |
| creator_name | "蒋小刚" |
| creator_number | "multicorp_6171610_-952599178" |
| modifier_id | "425692833" |
| modifier_name | "叶健乐" |
| modifier_number | "multicorp_6171610_1161291713" |
| custom_field | {"custom_field__1__4ujia65gxej1x1":""} |
| mulbill_label | [] |
| cus_bear_fee_entry | [] |
| delivery_type_id | "6" |
| delivery_type_name | "物流发货" |
| delivery_type_number | "JHFS01" |
| currency_id | "100000" |
| due_date | "2026-10-14" |
| setting_term_id | "" |
| setting_term_number | "" |
| setting_term_name | "" |
| express_entity | [{"seq":1,"id":"2590046340872617986","delivery_bill_no":"390031409461","delivery_time":"","express_company_id":"","express_company_number":"","express |
| vrp_entity | [] |
| customer_number | "C-000" |
| customer_name | "张莉" |
| cost_fee_entity | null |
| currency_name | "人民币" |
| exchange_rate | "1" |

### 分录(首条)

| 键 | 样例值 |
|---|---|
| id | "2590046340872617984" |
| picture | "" |
| material_id | "2182903275219680256" |
| material_name | "S阻垢炭棒/滤芯" |
| material_number | "S031-1" |
| material_is_multi_unit | false |
| material_is_serial | false |
| material_is_asst_attr | false |
| material_is_kf_period | false |
| material_is_batch | true |
| material_model | "28*12*178" |
| material_help_code | "" |
| stock_id | "2220441270411712512" |
| stock_name | "成品B仓" |
| stock_number | "CP-02" |
| stock_is_allow_freight | false |
| sp_id | "" |
| sp_name | "" |
| sp_number | "" |
| aux_prop_id | "" |
| aux_prop_name | "" |
| aux_prop_number | "" |
| aux_id1 | "" |
| aux_name1 | "" |
| aux_number1 | "" |
| aux_id2 | "" |
| aux_name2 | "" |
| aux_number2 | "" |
| aux_id3 | "" |
| aux_name3 | "" |
| aux_number3 | "" |
| aux_id4 | "" |
| aux_name4 | "" |
| aux_number4 | "" |
| aux_id5 | "" |
| aux_name5 | "" |
| aux_number5 | "" |
| barcode | "" |
| price | 15 |
| tax_price | 15 |
| act_tax_price | 15 |
| base_unit_id | "3" |
| base_unit_name | "支" |
| base_unit_number | "支" |
| unit_id | "3" |
| unit_name | "支" |
| unit_number | "支" |
| coefficient | 1 |
| conversion_rate | "" |
| qty | 100 |
| inv_qty | 175 |
| inv_base_qty | 0 |
| return_qty | 0 |
| all_amount | 1500 |
| tax_amount | 0 |
| bill_dis_distribution | 0 |
| discount | 10 |
| fee | 0 |
| divide_diff_amount | 0 |
| dis_rate | 0 |
| amount | 1500 |
| pre_dis_amount | 1500 |
| act_non_tax_amount | 1500 |
| unit_cost | 0 |
| cost | 0 |
| cur_settle_amount | 1500 |
| dis_amount | 0 |
| dis_price | 15 |
| batch_no | "PC0000" |
| pro_place | "" |
| pro_reg_no | "" |
| pro_license | "" |
| kf_date | "" |
| valid_date | "" |
| kf_type | "" |
| kf_period | 0 |
| sn_list_id | "0" |
| aux_unit_id | "" |
| aux_unit_name | "" |
| aux_unit_number | "" |
| aux_coefficient | 0 |
| aux_qty | 0 |
| cess | 0 |
| seq | 1 |
| entry_status | "" |
| entry_settle_status | "C" |
| is_free | false |
| comment | "" |
| src_order_id | "" |
| src_bill_no | "ZL-20261014-02" |
| src_bill_type_id | "sal_bill_order" |
| src_bill_type_name | "销售订单" |
| src_bill_type_number | "sal_bill_order" |
| src_inter_id | "2589885953732602880" |
| src_bill_date | "" |
| src_seq | 1 |
| src_entry_id | "2589885953732601856" |
| custom_entity_field | {"custom_entity_field__6__4ztpmqhxoytj":"28复合/大T33"} |
| sn_list | "" |
| base_qty | 100 |
| dis_tax_amount | "0" |
| cus_bill_no | "" |
| entry_un_ivc_qty | "100" |
| entry_ivc_qty | "0" |
| entry_ivc_amount | "0" |
| entry_un_ivc_amount | "1500" |
| all_amount_for | "1500" |
