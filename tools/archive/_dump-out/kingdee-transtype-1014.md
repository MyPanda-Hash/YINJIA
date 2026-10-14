# 其他入库/出库「业务类型」键位定位(沙箱实测)

- 时间:2026-10-14T10:59:04.032Z  账套:沙箱 outerInstanceId=579046204055359488

## 一、业务类型键位:逐个单独试(其他入库,目标 id=12 / number=QTRKLX01)

- [inv_other_in] 只发 trans_type_id="12" → ✅ QTRK-20261014-00002  落库业务类型:id=`12` number=`QTRKLX01` name=`其他入库`
- [inv_other_in] 只发 trans_type_number="QTRKLX01" → ❌ errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_in]
- [inv_other_in] 只发 trans_type_name="其他入库" → ❌ errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_in]
- [inv_other_in] 只发 trans_type="2" → ❌ errcode=1000002001 请求接口返回失败:请填写“业务类型”。 [POST /jdy/v2/scm/inv_other_in]
- [inv_other_in] trans_type_id + trans_type_number → ✅ QTRK-20261014-00003  落库业务类型:id=`12` number=`QTRKLX01` name=`其他入库`

## 二、业务类型档案接口探测(能否按账套列出可选业务类型)

- /jdy/v2/bd/trans_type            ❌ HTTP 519 status code 519
- /jdy/v2/scm/trans_type           ❌ HTTP 519 status code 519
- /jdy/v2/bd/trans_type_list       ❌ HTTP 519 status code 519
- /jdy/v2/scm/inv_trans_type       ❌ HTTP 519 status code 519
- /jdy/v2/bd/other_in_type         ❌ HTTP 519 status code 519
- /jdy/v2/bd/bill_type             ❌ HTTP 519 status code 519
- /jdy/v2/scm/inv_other_in_type    ❌ HTTP 519 status code 519
- /jdy/v2/sys/trans_type           ❌ HTTP 519 status code 519

## 三、本次创建的测试单

- [inv_other_in] id=`2590197011512825856` 单号=QTRK-20261014-00002
- [inv_other_in] id=`2590197046778533888` 单号=QTRK-20261014-00003