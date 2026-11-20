# 工艺路线「生效日期 / 失效日期」取消必填（2026-11-20）

> 用户口径：「工序路线中生效日期和失效日期也不用必填。」
> 承接 2026-11-19「工艺路线中工序控制不需要必填」；同属 ROUTE 面板的必填收口。

## 改动

- 新增迁移 `tools/migrate-route-dates-optional-20261120.sql`，并登记到
  `tools/db-migrations.txt`（独立脚本，不改 2026-11-19 工序控制脚本字节）。
- `yj_field`：`ROUTE` 面板 `(col_name,label)` =（`生效日期`）、（`失效日期`）两行
  `required → 0`；末尾自检 required=1 残留必须为 0。

## 两账套执行

```text
[print] [待改] HSDZ_MES:ROUTE/生效日期+失效日期 required=1 共 2 行
[print] [OK] HSDZ_MES:生效日期 / 失效日期已改为非必填
[print] [CHECK-OK] HSDZ_MES:ROUTE/生效日期+失效日期 非必填(required=0)
[OK] 1 batches

[print] [待改] HSDZ_MES_TEST:ROUTE/生效日期+失效日期 required=1 共 2 行
[print] [OK] HSDZ_MES_TEST:生效日期 / 失效日期已改为非必填
[print] [CHECK-OK] HSDZ_MES_TEST:ROUTE/生效日期+失效日期 非必填(required=0)
[OK] 1 batches
```

## 界面/接口复核（8090 打包版）

- `GET /api/px/getPanelConfig?panelCode=ROUTE`：`生效日期.required=false`、
  `失效日期.required=false`、`工序控制.required=false`；`工艺路线编码/名称` 仍 required。
- 页面表头标签不再有红色 `*`（见 `工艺路线-生效失效日期非必填.png`；
  编码/名称仍带 `*`）。

## 取证脚本

`verify-route-header-dates.mjs`：打开 ROUTE 面板，读取表头 `label.req` 与
`getPanelConfig` 返回，打印两日期 `required=false` 并截图。
