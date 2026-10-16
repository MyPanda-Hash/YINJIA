# 金蝶拉取前侦察:时间过滤口径 + 9/1 至今数据量

- 账套:惠州市银嘉环保(outerInstanceId 580147507460444160,只读)
- 区间:2026-09-01 00:00 ~ 2026-10-15(现在)
- 抓取时间:2026-10-15T22:40:48.692Z

## 一、时间过滤参数探测(以采购入库单为例,看 count 是否随过滤变化)

- 无过滤(全量)            : count=3389
- bill_date_start/end       : count=3389
- create_time_start/end(毫秒) : count=3389
- modify_start_time/end(毫秒) : count=524
- create_start_time/end(毫秒) : count=321
- date_start/end            : count=3389

## 二、按**生效的**过滤键统计(⚠ bill_date_* 被静默忽略,不能用)

| 单据 | 接口 | 全量(已审核) | create 在区间 | modify 在区间 |
|---|---|---|---|---|
| 采购订单 | `/jdy/v2/scm/pur_order` | 2243 | **187** | 195 |
| 销售订单 | `/jdy/v2/scm/sal_order` | 3961 | **265** | 287 |
| 采购入库单 | `/jdy/v2/scm/pur_inbound` | 3389 | **321** | 524 |
| 销售出库单 | `/jdy/v2/scm/sal_out_bound` | 5211 | **403** | 420 |
| 生产领料单(材料出库) | `/jdy/v2/scm/inv_pick` | 4992 | **4992** | 498 |
| 产品入库单(成品入库) | `/jdy/v2/scm/inv_product` | 2887 | **2887** | 241 |
| 其他入库单 | `/jdy/v2/scm/inv_other_in` | 79 | **12** | 12 |
| 其他出库单 | `/jdy/v2/scm/inv_other_out` | 1151 | **81** | 81 |