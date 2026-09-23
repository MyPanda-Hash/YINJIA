# 参考库工单表 `plang`

表名:plang(工单)| 主键:(comm, id),id 自增 | 共 55 列

| # | 列名 | 类型 | 可空 | 默认 | 备注 |
|---|---|---|---|---|---|
| 1 | comm | nvarchar(40) | 否 | | 公司 |
| 2 | id | int (自增) | 否 | | |
| 3 | pl_no | nvarchar(28) | 否 | | 工单号 |
| 4 | pl_xc | int | 是 | (0) | 项次 |
| 5 | scx | nvarchar(36) | 是 | | 生产线 |
| 6 | pl_man | nvarchar(40) | 是 | | 操作员 |
| 7 | pl_date | datetime | 是 | | 工单日期 |
| 8 | khdm | nvarchar(16) | 是 | | 客户代码 |
| 9 | dm | nvarchar(100) | 是 | | 产品代码 |
| 10 | mc | nvarchar(500) | 是 | | 产品名称 |
| 11 | gg | nvarchar(500) | 是 | | 产品规格 |
| 12 | gg2 | nvarchar(500) | 是 | | 产品规格2 |
| 13 | jldw | nvarchar(16) | 是 | | 计量单位 |
| 14 | pl_sl | float | 是 | (0) | 排产数量 |
| 15 | pl_sl2 | float | 是 | (0) | 排产数量2 |
| 16 | xq_sl | float | 是 | (0) | 需求数量 |
| 17 | rk_sl | float | 是 | (0) | 入库数量 |
| 18 | yl | float | 是 | (0) | 余量 |
| 19 | dj | float | 是 | (0) | 单价 |
| 20 | jine | float | 是 | (0) | 金额 |
| 21 | cp_date | datetime | 是 | | 计划完工日期 |
| 22 | st_date | datetime | 是 | | 开始日期 |
| 23 | cp_date2 | datetime | 是 | | 实际完工日期 |
| 24 | rk_no | nvarchar(60) | 是 | | 入库单号 |
| 25 | bz | ntext | 是 | | 备注 |
| 26 | ja | nvarchar(2) | 是 | | 结案 |
| 27 | od_no | nvarchar(48) | 是 | | 订单号 |
| 28 | od_xc | float | 是 | (0) | 订单项次 |
| 29 | lot_no | nvarchar(60) | 是 | | 批号 |
| 30 | color | nvarchar(60) | 是 | | 颜色 |
| 31 | siz | nvarchar(60) | 是 | | 尺码 |
| 32 | ll_no | nvarchar(60) | 是 | | 领料单号 |
| 33 | wb_no | nvarchar(60) | 是 | | 外包单号 |
| 34 | lb | nvarchar(4) | 是 | | 类别 |
| 35 | mjlx | nvarchar(40) | 是 | | 模具类型 |
| 36 | BomId | int | 是 | (0) | 完工标记 |
| 37 | ypl_sl | float | 是 | (0) | 已排产数量 |
| 38 | ll_no2 | nvarchar(60) | 是 | | 领料单号2 |
| 39 | remark | nvarchar(500) | 是 | | 备注2 |
| 40 | MoDId | int | 是 | | 生产工单明细ID |
| 41 | llxz | nvarchar(60) | 是 | | 来料性质 |
| 42 | cgrkdh | nvarchar(60) | 是 | | 采购入库单号 |
| 43 | lldh | nvarchar(60) | 是 | | 来料单号 |
| 44 | djlx | nvarchar(60) | 是 | | 单据类型 |
| 45 | zl | float | 是 | (0) | 重量 |
| 46 | asp_user1 | nvarchar(40) | 是 | ('') | 创建人 |
| 47 | asp_time1 | datetime | 是 | (getdate()) | 创建时间 |
| 48 | asp_user2 | nvarchar(40) | 是 | ('') | 最后修改人 |
| 49 | asp_time2 | datetime | 是 | | 最后修改时间 |
| 50 | asp_user3 | nvarchar(40) | 是 | ('') | 审核人 |
| 51 | asp_time3 | datetime | 是 | | 审核时间 |
| 52 | asp_cancel | varchar(1) | 是 | | 删除标记 |
| 53 | asp_user4 | nvarchar(40) | 是 | ('') | 删除人 |
| 54 | asp_time4 | datetime | 是 | | 删除时间 |
| 55 | asp_print | int | 是 | (0) | 打印次数 |
