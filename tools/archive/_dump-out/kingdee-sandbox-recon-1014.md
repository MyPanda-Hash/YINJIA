# 沙箱三类目标单据现状侦察(只读)

- 账套: 华实创新(惠州)科技有限公司 outerInstanceId=579046204055359488(clientId=359220)
- 时间: 2026-10-14T10:43:20.699Z

## ① 单据数量 + 最近一张详情关键键

### 产品入库单 `/jdy/v2/scm/inv_product`(count=0)

(沙箱内无单据)

### 其他入库单 `/jdy/v2/scm/inv_other_in`(count=0)

(沙箱内无单据)

### 其他出库单 `/jdy/v2/scm/inv_other_out`(count=0)

(沙箱内无单据)

### 生产领料单(对照) `/jdy/v2/scm/inv_pick`(count=2)

最近 2 张单号: SCLL-20261004-00002(2026-10-04,Z) / SCLL-20261004-00001(2026-10-04,Z)

详情顶层键 33 个;业务类型族 = 
表头取样: dept_id=(空) emp_id=2569801442089090048 bill_no=SCLL-20261004-00002 bill_type_id=inv_pick_bill
表头全键: id, bill_no, bill_date, bill_status, create_time, modify_time, audit_time, creator_id, creator_name, creator_number, modifier_id, modifier_name, modifier_number, bill_type_name, bill_type_number, bill_type_id, auditor_id, auditor_name, auditor_number, remark, dept_id, dept_name, dept_number, emp_id, emp_name, emp_number, material_entity, custom_field, mul_bill_label, pick_use_name, pick_use_id, pick_use_number, pick_type

分录键 74 个;首行关键值: material_id=2569796698868037632 material_number=YJ-SX-031 stock_id=2569796687375644672/CK00006 unit_id=1 base_unit_id=1 qty=10 batch_no="" coefficient=1 material_is_batch=false

### 采购入库单(对照) `/jdy/v2/scm/pur_inbound`(count=27)

最近 3 张单号: CGRK-20260924-00041(2026-09-24,Z) / CGRK-20261007-00040(2026-10-07,Z) / CGRK-20260928-00039(2026-09-28,Z)

详情顶层键 92 个;业务类型族 = trans_type="2"
表头取样: dept_id=(空) emp_id=(空) bill_no=CGRK-20260924-00041 bill_type_id=(无此键)
表头全键: id, bill_no, bill_date, bill_status, create_time, modify_time, audit_time, creator_id, creator_name, creator_number, modifier_id, modifier_name, modifier_number, auditor_id, auditor_name, auditor_number, trans_type, remark, dept_id, dept_name, dept_number, emp_id, emp_name, emp_number, customer_id, customer_name, customer_number, supplier_id, supplier_name, supplier_number, contact_phone, contact_country_id, contact_country_name, contact_country_number, contact_province_id, contact_province_name, contact_province_number, contact_city_id, contact_city_name, contact_city_number, contact_district_id, contact_district_name, contact_district_number, contact_address, total_unsettle_amount, total_unsettle_amount_for, exchange_rate, settle_status, all_debt, last_debt, total_amount, edit_pay_type_id, edit_pay_type_name, edit_pay_type_number, total_pre_amount, bill_dis_amount, edit_pay_account_id, edit_pay_account_name, edit_pay_account_number, bill_dis_rate, total_ins_amount, material_entity, custom_field, currency_id, due_date, setting_term_id, setting_term_number, setting_term_name, dispatcher_linkman, dispatcher_phone, dispatcher_address, dispatcher_country_id, dispatcher_country_name, dispatcher_country_number, dispatcher_province_id, dispatcher_province_name, dispatcher_province_number, dispatcher_city_id, dispatcher_city_name, dispatcher_city_number, dispatcher_district_id, dispatcher_district_name, dispatcher_district_number, cost_fee_entity, payment_entry, attachments_url, bill_stock_id, bill_stock_name, bill_stock_number, bill_sp_id, bill_sp_name, bill_sp_number

分录键 83 个;首行关键值: material_id=2570403514287242240 material_number=YJ-JPL-70 stock_id=2569796687375644672/CK00006 unit_id=1 base_unit_id=1 qty=1 batch_no="" coefficient=1 material_is_batch=false

## ② 商品档案:批次/多单位/单位 明细采样

商品共 298 个,本页 100 个

| id | number | name | is_batch | is_multi_unit | base_unit_id/name | 其它单位 |
|---|---|---|---|---|---|---|
| 2569796588071402496 | C-95-13 | 006项目/功能炭棒滤芯 | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797727873416192 | C-95-13**TB | 006项目/功能炭棒滤芯(C-95-13**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797731237246976 | C-95-14 | 006项目/功能炭棒滤芯(C-95-14) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797737033997312 | C-95-14**TB | 006项目/功能炭棒滤芯(C-95-14**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797742352152577 | C-95-15 | 006项目/功能炭棒滤芯(C-95-15) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797745976130560 | C-95-15**TB | 006项目/功能炭棒滤芯(C-95-15**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797753290996736 | C-95-16 | 006项目/功能炭棒滤芯(C-95-16) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797757032315905 | C-95-16**TB | 006项目/功能炭棒滤芯(C-95-16**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797760614152192 | C-95-17 | 006项目/功能炭棒滤芯(C-95-17) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797764816944128 | C-95-17**TB | 006项目/功能炭棒滤芯(C-95-17**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797770697358336 | C-95-18 | 006项目/功能炭棒滤芯(C-95-18) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797777005492224 | C-95-18**TB | 006项目/功能炭棒滤芯(C-95-18**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797782541973504 | C-95-19 | 006项目/功能炭棒滤芯(C-95-19) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797798631324672 | C-95-19**TB | 006项目/功能炭棒滤芯(C-95-19**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797802750352384 | C-95-20 | 006项目/功能炭棒滤芯(C-95-20) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797807338798080 | C-95-20**TB | 006项目/功能炭棒滤芯(C-95-20**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797812422196224 | C-95-21 | 006项目/功能炭棒滤芯(C-95-21) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569797817329531904 | C-95-21**TB | 006项目/功能炭棒滤芯(C-95-21**TB) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569927196927869952 | C-95-13-V2 | 006项目/功能炭棒滤芯(全字段) | false | false | 3/支 | ["is_multi_unit=false","base_unit_id=\"3\"","base_unit_number=\"支\"","base_unit_name=\"支\"","units=[]","purchase_unit_id=\"3\""] |
| 2569796622649146368 | A-43-05 | 032 | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569796627732741120 | A-43-06 | 032s | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569796630291266560 | YJ-SX-011-8 | 032S端盖 | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569927232034193408 | YJ-SX-011-8-V2 | 032S端盖(全字段) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569796636221914112 | YJ-SX-011-6 | 032端盖 | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |
| 2569927233938407424 | YJ-SX-011-6-V2 | 032端盖(全字段) | false | false | 1/个 | ["is_multi_unit=false","base_unit_id=\"1\"","base_unit_number=\"个\"","base_unit_name=\"个\"","units=[]","purchase_unit_id=\"1\""] |

商品档案全键: parent_name, number, parent_number, parent_id, name, id, is_multi_unit, is_serial, is_asst_attr, is_weight, is_kf_period, is_batch, url, model, barcode, is_show_aux_barcode, mul_label, check_type, brand_id, brand_name, brand_number, producing_pace, help_code, base_unit_id, base_unit_number, base_unit_name, remark, units, stock_id, stock_name, stock_number, pro_license, purchase_unit_id, is_self_restraint, short_name

## ③ 商品详情(取单个商品的单位/批次,确认可用 unit_id)

### C-95-13 006项目/功能炭棒滤芯 (id=2569796588071402496)
键: id, number, name, enable, base_unit_id, base_unit_name, aux_unit_name, mul_label, barcode, model, brand_id, producing_pace, help_code, is_multi_unit, fix_unit_id1, coefficient1, conversion_unit_id1, fix_unit_id2, coefficient2, conversion_unit_id2, fix_unit_id3, coefficient3, conversion_unit_id3, purchase_unit_id, sale_unit_id, store_unit_id, aux_unit_id, aux_unit_number, is_weight, is_serial, is_batch, is_sale, is_purchase, is_subpart, is_assembly, is_kf_period, kf_period_type, kf_period, alarm_day, is_asst_attr, aux_entity, barcode_entity, price_entity, inv_mgr_type, min_inventory_qty, max_inventory_qty, sec_inventory_qty, cost_method, fetch_category_id, tax_rate, in_tax_rate, stock_id, space_id, vender_id, purchase_id, refistration_number, pro_license, gross_weight, net_weight, weight_unit_id, length, wide, high, volume, images, check_type, remark, custom_field, parent_number, parent_id, bom_entity, valid_qty, qty_inv, attachments_url, product_department_id, product_department_number, min_package_qty, modify_time, is_backflushed, backflushed_stock_id, backflushed_stock_name, backflushed_stock_number, backflushed_space_id, backflushed_space_name, backflushed_space_number, short_name
is_batch=false is_multi_unit=false base_unit_id=1 base_unit_name=个 sale_unit_id=1 pur_unit_id=undefined stock_unit_id=undefined
多单位分录: (无此键)

### C-95-13**TB 006项目/功能炭棒滤芯(C-95-13**TB) (id=2569797727873416192)
键: id, number, name, enable, base_unit_id, base_unit_name, aux_unit_name, mul_label, barcode, model, brand_id, producing_pace, help_code, is_multi_unit, fix_unit_id1, coefficient1, conversion_unit_id1, fix_unit_id2, coefficient2, conversion_unit_id2, fix_unit_id3, coefficient3, conversion_unit_id3, purchase_unit_id, sale_unit_id, store_unit_id, aux_unit_id, aux_unit_number, is_weight, is_serial, is_batch, is_sale, is_purchase, is_subpart, is_assembly, is_kf_period, kf_period_type, kf_period, alarm_day, is_asst_attr, aux_entity, barcode_entity, price_entity, inv_mgr_type, min_inventory_qty, max_inventory_qty, sec_inventory_qty, cost_method, fetch_category_id, tax_rate, in_tax_rate, stock_id, space_id, vender_id, purchase_id, refistration_number, pro_license, gross_weight, net_weight, weight_unit_id, length, wide, high, volume, images, check_type, remark, custom_field, parent_number, parent_id, bom_entity, valid_qty, qty_inv, attachments_url, product_department_id, product_department_number, min_package_qty, modify_time, is_backflushed, backflushed_stock_id, backflushed_stock_name, backflushed_stock_number, backflushed_space_id, backflushed_space_name, backflushed_space_number, short_name
is_batch=false is_multi_unit=false base_unit_id=1 base_unit_name=个 sale_unit_id=1 pur_unit_id=undefined stock_unit_id=undefined
多单位分录: (无此键)

### C-95-14 006项目/功能炭棒滤芯(C-95-14) (id=2569797731237246976)
键: id, number, name, enable, base_unit_id, base_unit_name, aux_unit_name, mul_label, barcode, model, brand_id, producing_pace, help_code, is_multi_unit, fix_unit_id1, coefficient1, conversion_unit_id1, fix_unit_id2, coefficient2, conversion_unit_id2, fix_unit_id3, coefficient3, conversion_unit_id3, purchase_unit_id, sale_unit_id, store_unit_id, aux_unit_id, aux_unit_number, is_weight, is_serial, is_batch, is_sale, is_purchase, is_subpart, is_assembly, is_kf_period, kf_period_type, kf_period, alarm_day, is_asst_attr, aux_entity, barcode_entity, price_entity, inv_mgr_type, min_inventory_qty, max_inventory_qty, sec_inventory_qty, cost_method, fetch_category_id, tax_rate, in_tax_rate, stock_id, space_id, vender_id, purchase_id, refistration_number, pro_license, gross_weight, net_weight, weight_unit_id, length, wide, high, volume, images, check_type, remark, custom_field, parent_number, parent_id, bom_entity, valid_qty, qty_inv, attachments_url, product_department_id, product_department_number, min_package_qty, modify_time, is_backflushed, backflushed_stock_id, backflushed_stock_name, backflushed_stock_number, backflushed_space_id, backflushed_space_name, backflushed_space_number, short_name
is_batch=false is_multi_unit=false base_unit_id=1 base_unit_name=个 sale_unit_id=1 pur_unit_id=undefined stock_unit_id=undefined
多单位分录: (无此键)

