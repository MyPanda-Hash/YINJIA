# 金蝶拉取前侦察:时间过滤口径 + 9/1 至今数据量

- 账套:惠州市银嘉环保(outerInstanceId 580147507460444160,只读)
- 区间:2026-09-01 00:00 ~ 2026-10-14(现在)
- 抓取时间:2026-10-14T11:44:26.726Z

## 一、时间过滤参数探测(以采购入库单为例,看 count 是否随过滤变化)

- 无过滤(全量)            : count=3382
- bill_date_start/end       : count=3382
- create_time_start/end(毫秒) : count=3382
- modify_start_time/end(毫秒) : count=517
- create_start_time/end(毫秒) : count=314
- date_start/end            : count=3382

## 二、按**生效的**过滤键统计(⚠ bill_date_* 被静默忽略,不能用)

| 单据 | 接口 | 全量(已审核) | create 在区间 | modify 在区间 |
|---|---|---|---|---|
| 采购订单 | `/jdy/v2/scm/pur_order` | 2243 | **187** | 195 |
| 销售订单 | `/jdy/v2/scm/sal_order` | 3949 | **253** | 275 |
| 采购入库单 | `/jdy/v2/scm/pur_inbound` | 3382 | **314** | 517 |
| 销售出库单 | `/jdy/v2/scm/sal_out_bound` | 5209 | **401** | 418 |
| 生产领料单(材料出库) | `/jdy/v2/scm/inv_pick` | 4981 | **4981** | 487 |
| 产品入库单(成品入库) | `/jdy/v2/scm/inv_product` | 2882 | **2882** | 236 |
| 其他入库单 | `/jdy/v2/scm/inv_other_in` | 81 | **14** | 14 |
| 其他出库单 | `/jdy/v2/scm/inv_other_out` | 1150 | **80** | 80 |