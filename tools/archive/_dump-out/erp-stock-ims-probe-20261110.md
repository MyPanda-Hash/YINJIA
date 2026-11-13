# 金蝶现存量接口取证(/jdy/v2/inv/inv_inventory_ims)

- 账套 clientId=359797 outerInstanceId=580147507460444160  时间=2026-11-10T04:36:55.554Z

- 顶层键:total_page, current_page_size, count, page_size, page, rows, sum
- count = 1396
- 首行键(43):material_picture, material_id, material_number, material_name, material_category_name, barcode, material_model, material_help_code, material_is_asst_attr, material_is_batch, material_is_kf_period, material_brand_name, aux_prop_id, aux_prop_name, batch_no, kf_period, kf_type, valid_date, kf_date, base_unit_id, stock_id, stock_number, stockid_name, stock_is_allow_freight, aux_unit_id, aux_unit_name, cost, unit_cost, retail_price, retail_amount, purchase_price, purchase_amount, trade_price, trade_amount, qty, aux_qty, pkg_qty, valid_qty, valid_aux_qty, pkg_valid_qty, sp_id, sp_number, sp_name

```json
{
 "material_picture": "",
 "material_id": "2467487304869110784",
 "material_number": "3-01-16-0012",
 "material_name": "SP-FX2-X60-RO",
 "material_category_name": "客供",
 "barcode": "",
 "material_model": "",
 "material_help_code": "SP-FX2-X60-RO",
 "material_is_asst_attr": false,
 "material_is_batch": false,
 "material_is_kf_period": false,
 "material_brand_name": "",
 "aux_prop_id": "",
 "aux_prop_name": "",
 "batch_no": "",
 "kf_period": "",
 "kf_type": "空值",
 "valid_date": "",
 "kf_date": "",
 "base_unit_id": "7",
 "stock_id": "2243772584451731456",
 "stock_number": "YCL-01",
 "stockid_name": "恒亿仓",
 "stock_is_allow_freight": false,
 "aux_unit_id": "7",
 "aux_unit_name": "kg",
 "cost": null,
 "unit_cost": null,
 "retail_price": 0,
 "retail_amount": 0,
 "purchase_price": 0,
 "purchase_amount": 0,
 "trade_price": 0,
 "trade_amount": 0,
 "qty": 53,
 "aux_qty": 53,
 "pkg_qty": "53kg",
 "valid_qty": 53,
 "valid_aux_qty": 53,
 "pkg_valid_qty": "53kg",
 "sp_id": "",
 "sp_number": "",
 "sp_name": ""
}
```

- 翻页实测:3 页 · 共 1396 行(page_size=500)

## 键形态统计

- 有 material_number:1396 / 1396
- stock_number 为空:0(stock_id 有值 1396)
- batch_no 为空:1396;= PC0000:0;其它:0
- 重复三键(物料|仓库|批号)组数:0
- 数量合计:4314349.6070;数量为 0 的行:0;负数行:3
- 单位键样例:(空)
- 仓库样例:YCL-01/恒亿仓 · CP-02/成品B仓 · CK00003/成品不良品区 · CK00006/华北工控仓 · CK00005/原料不良品仓

## 与 MES kucun 对照(HSDZ_MES,只读)

- 金蝶键 1396 · MES 键 2152 · 交集 1263
- 交集里逐键一致 742 / 数量不同 521
- 仅金蝶有 133 · 仅 MES 有 889
- 金蝶合计 4314349.61 · MES 合计 5846961.41