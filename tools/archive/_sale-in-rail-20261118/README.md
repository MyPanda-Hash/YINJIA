# 销售退货单补左侧「单据选择」栏(2026-11-18)

用户口径:「销售退货页补齐」—— 承接上一条「生产退料少了这一块」:销售退货单(SALE_IN)与
生产退料单(MATERIAL_RET)是 2026-11-13 同一批新建的两张退货单,**都漏登记在**
`PanelxList.vue` 的 `DOC_RAIL_PANELS` 里(该表为 null ⇒ 页面不渲染左栏)。

## 改动(纯前端登记,不动面板/表/权限)

```js
SALE_IN: ['客户', ERP_TAG_COL],
```

左栏列序由 `docRailCfg` 统一组装 = 单号 | 日期 | 客户 | ERP单 | 审核状态。

## 中间列怎么挑的(实测有值率,空列等于没配)

`bd_sale_in` 现存单据:TEST 3 张(SR-2026-11-0001..0003)、正式库 0 张。

| 候选列 | TEST 3 张 | 取舍 |
|---|---|---|
| 客户 | 3/3 | ✅ 与姊妹单销售出库单(SALE_OUT)同列 |
| 是否已转ERP | 2/3 | ✅ 复用 `ERP_TAG_COL`(已转/未转) |
| ERP单号 | 2/3 | ✅ 同上派生 |
| 退货原因 | 1/3 | ✗ 样本太少,暂不入列 |
| 销售订单号 | 0/3 | ✗ 现有 3 张都是手工建单、还没挂订单;等真从销售订单/出库单选单过来再在 `DOC_RAIL_PANELS` 加一个字符串即可 |
| 退货类别 / 部门 / 经手人 | 0/3 | ✗ 全空 |

## 证据(可复跑)

- `probes/probe-header-fields.sql`:SALE_IN 的 header/query 字段清单(可见 20 个,无「来源出库单」只有「销售订单号」)
- `probes/probe-fillrate.sql`:两账套逐列有值率(正式库 0 张,故以测试库为准)
- `ui/round-11.mjs` / `round-11-salein-rail.png`:5173(源码)左栏实测 3 条
- `ui/round-12.mjs` / `round-12-8090-salein.png`:8090(打包,入口 `index-jX1AHAfK.js`)同款

## 复核

- 左栏标题「销售退货单选择」,共 3 条,点行即切单;页面无报错条,明细表格列不变;
- 前端全量 `node --test` 2032/2032 绿;
- 静态产物同步到 `backend/src/main/resources/static` 并 `jar uf` 进 8090 的 jar(该 static 尚混有
  另一条在办任务的前端改动,故与上一条同款**不单独提交 static**,由那条任务收尾时一并入账)。
