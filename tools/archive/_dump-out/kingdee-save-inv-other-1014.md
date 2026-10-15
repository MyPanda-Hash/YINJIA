# 沙箱实测:其他入库单 / 其他出库单保存接口字段

- 时间:2026-10-14T10:58:36.553Z  账套:沙箱 华实创新 outerInstanceId=579046204055359488



# ══════ inv_other_in ══════

## [inv_other_in] ① 最小(只 bill_date + 一行)

```json
{
 "bill_date": "2026-10-14",
 "material_entity": [
  {
   "material_id": "2569796588071402496",
   "qty": "1",
   "unit_id": "1",
   "stock_id": "2569796666798488576"
  }
 ]
}
```

❌ 保存失败:errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_in]

## [inv_other_in] ② 最小 + trans_type="2"(沿用 pur_inbound 口径)

```json
{
 "bill_date": "2026-10-14",
 "trans_type": "2",
 "material_entity": [
  {
   "material_id": "2569796588071402496",
   "qty": "1",
   "unit_id": "1",
   "stock_id": "2569796666798488576"
  }
 ]
}
```

❌ 保存失败:errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_in]

## [inv_other_in] ③ 最小 + trans_type_number/name(真实账套实测的业务类型)

```json
{
 "bill_date": "2026-10-14",
 "trans_type_number": "QTRKLX01",
 "trans_type_name": "其他入库",
 "material_entity": [
  {
   "material_id": "2569796588071402496",
   "qty": "1",
   "unit_id": "1",
   "stock_id": "2569796666798488576"
  }
 ]
}
```

❌ 保存失败:errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_in]

## [inv_other_in] ④ 全字段版(头:业务类型三键 + 对方单位 + 部门/经手人;行:序号/单位族/批次/成本)

```json
{
 "bill_date": "2026-10-14",
 "trans_type": "2",
 "trans_type_id": "12",
 "trans_type_number": "QTRKLX01",
 "trans_type_name": "其他入库",
 "supplier_number": "GYS00014",
 "supplier_name": "KG",
 "dept_number": "100000",
 "dept_id": "100000",
 "emp_number": "ZY00099",
 "emp_id": "2569801440696481792",
 "remark": "[MES:SAVEPROBE-inv_other_in]",
 "material_entity": [
  {
   "seq": "1",
   "material_id": "2569796588071402496",
   "material_number": "C-95-13",
   "material_name": "006项目/功能炭棒滤芯",
   "qty": "3",
   "base_qty": "3",
   "unit_id": "1",
   "unit_number": "个",
   "base_unit_id": "1",
   "base_unit_number": "个",
   "stock_id": "2569796666798488576",
   "stock_number": "CK04",
   "batch_no": "SAVEPROBE",
   "comment": "字段探针",
   "cost": "12.5",
   "unit_cost": "4.17"
  }
 ]
}
```

✅ 保存成功:id=`2590196806294068224` 单号=`QTRK-20261014-00001`
落库:QTRK-20261014-00001(2026-10-14) 状态=Z
  **业务类型落库值**: trans_type_id=`12` trans_type_number=`QTRKLX01` trans_type_name=`其他入库`

| 发出键 | 落库有值? | 落库值 |
|---|---|---|
| `bill_date` | 是 | "2026-10-14" |
| `trans_type` | **否(静默忽略)** |  |
| `trans_type_id` | 是 | "12" |
| `trans_type_number` | 是 | "QTRKLX01" |
| `trans_type_name` | 是 | "其他入库" |
| `supplier_number` | 是 | "GYS00014" |
| `supplier_name` | 是 | "KG" |
| `dept_number` | 是 | "100000" |
| `dept_id` | 是 | "100000" |
| `emp_number` | 是 | "ZY00099" |
| `emp_id` | 是 | "2569801440696481792" |
| `remark` | 是 | "[MES:SAVEPROBE-inv_other_in]" |
| (分录)`seq` | 是 | 1 |
| (分录)`material_id` | 是 | "2569796588071402496" |
| (分录)`material_number` | 是 | "C-95-13" |
| (分录)`material_name` | 是 | "006项目/功能炭棒滤芯" |
| (分录)`qty` | 是 | 3 |
| (分录)`base_qty` | 是 | 3 |
| (分录)`unit_id` | 是 | "1" |
| (分录)`unit_number` | 是 | "个" |
| (分录)`base_unit_id` | 是 | "1" |
| (分录)`base_unit_number` | 是 | "个" |
| (分录)`stock_id` | 是 | "2569796666798488576" |
| (分录)`stock_number` | 是 | "CK04" |
| (分录)`batch_no` | **否(静默忽略)** | "" |
| (分录)`comment` | 是 | "字段探针" |
| (分录)`cost` | 是 | 12.5 |
| (分录)`unit_cost` | 是 | 4.1666666667 |


# ══════ inv_other_out ══════

## [inv_other_out] ① 最小(只 bill_date + 一行)

```json
{
 "bill_date": "2026-10-14",
 "material_entity": [
  {
   "material_id": "2569796588071402496",
   "qty": "1",
   "unit_id": "1",
   "stock_id": "2569796666798488576"
  }
 ]
}
```

❌ 保存失败:errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_out]

## [inv_other_out] ② 最小 + trans_type="2"(沿用 pur_inbound 口径)

```json
{
 "bill_date": "2026-10-14",
 "trans_type": "2",
 "material_entity": [
  {
   "material_id": "2569796588071402496",
   "qty": "1",
   "unit_id": "1",
   "stock_id": "2569796666798488576"
  }
 ]
}
```

❌ 保存失败:errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_out]

## [inv_other_out] ③ 最小 + trans_type_number/name(真实账套实测的业务类型)

```json
{
 "bill_date": "2026-10-14",
 "trans_type_number": "QTCKLX01",
 "trans_type_name": "其他出库",
 "material_entity": [
  {
   "material_id": "2569796588071402496",
   "qty": "1",
   "unit_id": "1",
   "stock_id": "2569796666798488576"
  }
 ]
}
```

❌ 保存失败:errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_out]

## [inv_other_out] ④ 全字段版(头:业务类型三键 + 对方单位 + 部门/经手人;行:序号/单位族/批次/成本)

```json
{
 "bill_date": "2026-10-14",
 "trans_type": "2",
 "trans_type_id": "13",
 "trans_type_number": "QTCKLX01",
 "trans_type_name": "其他出库",
 "supplier_number": "GYS00014",
 "supplier_name": "KG",
 "dept_number": "100000",
 "dept_id": "100000",
 "emp_number": "ZY00099",
 "emp_id": "2569801440696481792",
 "remark": "[MES:SAVEPROBE-inv_other_out]",
 "material_entity": [
  {
   "seq": "1",
   "material_id": "2569796588071402496",
   "material_number": "C-95-13",
   "material_name": "006项目/功能炭棒滤芯",
   "qty": "3",
   "base_qty": "3",
   "unit_id": "1",
   "unit_number": "个",
   "base_unit_id": "1",
   "base_unit_number": "个",
   "stock_id": "2569796666798488576",
   "stock_number": "CK04",
   "batch_no": "SAVEPROBE",
   "comment": "字段探针",
   "cost": "12.5",
   "unit_cost": "4.17"
  }
 ]
}
```

✅ 保存成功:id=`2590196846332752896` 单号=`QTCK-20261014-00001`
落库:QTCK-20261014-00001(2026-10-14) 状态=Z
  **业务类型落库值**: trans_type_id=`13` trans_type_number=`QTCKLX01` trans_type_name=`其他出库`

| 发出键 | 落库有值? | 落库值 |
|---|---|---|
| `bill_date` | 是 | "2026-10-14" |
| `trans_type` | **否(静默忽略)** |  |
| `trans_type_id` | 是 | "13" |
| `trans_type_number` | 是 | "QTCKLX01" |
| `trans_type_name` | 是 | "其他出库" |
| `supplier_number` | **否(静默忽略)** |  |
| `supplier_name` | **否(静默忽略)** |  |
| `dept_number` | 是 | "100000" |
| `dept_id` | 是 | "100000" |
| `emp_number` | 是 | "ZY00099" |
| `emp_id` | 是 | "2569801440696481792" |
| `remark` | 是 | "[MES:SAVEPROBE-inv_other_out]" |
| (分录)`seq` | 是 | 1 |
| (分录)`material_id` | 是 | "2569796588071402496" |
| (分录)`material_number` | 是 | "C-95-13" |
| (分录)`material_name` | 是 | "006项目/功能炭棒滤芯" |
| (分录)`qty` | 是 | 3 |
| (分录)`base_qty` | 是 | 3 |
| (分录)`unit_id` | 是 | "1" |
| (分录)`unit_number` | 是 | "个" |
| (分录)`base_unit_id` | 是 | "1" |
| (分录)`base_unit_number` | 是 | "个" |
| (分录)`stock_id` | 是 | "2569796666798488576" |
| (分录)`stock_number` | 是 | "CK04" |
| (分录)`batch_no` | **否(静默忽略)** | "" |
| (分录)`comment` | 是 | "字段探针" |
| (分录)`cost` | 是 | 12.5 |
| (分录)`unit_cost` | 是 | 4.17 |


## 本次在沙箱创建的测试单(供清理)

| 单据 | id | 单号 |
|---|---|---|
| inv_other_in | `2590196806294068224` | QTRK-20261014-00001 |
| inv_other_out | `2590196846332752896` | QTCK-20261014-00001 |