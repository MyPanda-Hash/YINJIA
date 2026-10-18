# 排产 → 领料 + 一单多张领料(2026-10-18)

用户口径:**「修改当前的这个领料和排产的流程,先要完成排产才进入到领料,同时需要让当前的一个
生产工单可以对应多个领料单据。」**

本目录是这次改动的**取证脚本与产物**(正式库只读;写操作全部只在测试账套 `HSDZ_MES_TEST`)。

## 改了什么

| 层 | 改动 | 位置 |
|---|---|---|
| 流程看板 | 生产链**第二条泳道**由「领料与排产」→「排产与领料」:快速排产 → 工单排产/预排线 → 产线排产负荷 → **材料出库单**;箭头文案「排产完成 → 转领料单」;生产链简介改为「… → 排产 → 领料 → …」 | `frontend/src/core/dashboard/flowSpec.js`、`FlowBoard.vue`、`i18n/locales/en.js` |
| 后端闸门 | 转领料单要求该工单行 **已排入产线(`plang.scx` 非空)且排产数量 > 0**;提示「未排产(未排入产线),请先在「快速排产」把该工单行排入产线后再转领料单」 | `WorkOrderPickingService.resolveLine` |
| 一单多张 | 移除两道「已有未审核领料单 ⇒ 拒绝」守卫:同一工单行每次点「转领料单」都新建一张(备注写明第几张);占用链仍每张一条 | `WorkOrderPickingService.pickOne` |
| 回写 | `ll_no2` 不再截「最近 3 张」:该行**全部**已审核领料单号按单号倒序写入,按列宽兜底 | `ManuWritebackService.refreshPickList` |
| 库 | `plang.ll_no2` 60→400、**`plang_pc.ll_no2` 30→400**、`bd_material_out(加工单号,工单行号)` 索引 | `tools/migrate-material-out-multi-pick-20261018.sql` |
| 前端提示 | 勾选行未排产(生产线空 / 排产数量 0)时先点名拦下,给可读提示;领料单号列加宽 | `WorkOrderList.vue` |

## 踩到的坑(重要)

`plang_pc.ll_no2` 原为 **nvarchar(30)**(`plang` 是 60)。`WorkOrderScheduleRecord.sync` 会把
`plang` 整行**镜像**到 `plang_pc`,`refreshPickList` 每次回写后都会调它 ——

* 1 张单号(15 字符)刚好装得下,**看不出问题**;
* 2 张单号 = `CL-2026-10-0071,CL-2026-10-0070` = **31 字符** ⇒ 审核报
  `String or binary data would be truncated`(整笔回滚,单据仍是草稿)。

⇒ 迁移脚本必须**两张表一起加宽**(实测证据:`_q-column-widths.sql`)。

## 追加修复(同日,用户报障「当前卡点转跳」)

用户口径:**「当前这上方的卡点转跳页面好像有问题,转跳的内容是图2的内容,应该是转到旧的生产工单内容了」**。

根因:看板顶部「当前卡点」气泡的点击只传 `panelCode`,前端一律拼 `/panelx/list/<code>`;
而 **ORDER_CONVERT / SCHEDULE_BOARD / WORK_ORDER_BOARD / WORK_ORDER_LIST 是页面级面板**
(`yj_panel` 里没有行,它们是专页)⇒ 落到一个空白的面板壳(工具栏 + 「第 0 张」,即用户图 2)。

修法:新增 `routeOf(code)`(**节点声明的 `route` 是唯一真源**),气泡与泳道节点统一走它;
兜底仍退回面板路径。钉子在 `flowSpec.test.js`「当前卡点跳转」一条(还会读
`FlowBoardService.blocks` 的源码把 panelCode 清单扫出来逐个校验,防以后新增卡点漏配)。
取证:`_probe-flow-block-jump.mjs` —— 5173 与 8090 各 **15/15**。

## 验证结果

| 探针 | 结果 | 说明 |
|---|---|---|
| `_api-picking-flow.mjs` | **13/13** | 未排产行 409 且提示点明;已排产行连转两张 `CL-2026-10-0070/0071`;单头 加工单号/工单行号/备注「第 N 张」全对 |
| `_api-audit-picks.mjs` + `_q-verify-ll-no2.sql` | 通过 | 两张探针单审核后 `plang.ll_no2 = plang_pc.ll_no2 = "CL-2026-10-0071,CL-2026-10-0070"`(31 字符) |
| `_api-cleanup-picks.mjs` | 通过 | 弃审 + 删除后回写重算回空(测试账套已清理干净) |
| `_probe-flow-board.mjs` | **8/8** | 5173/8090 实渲染:泳道名 = 排产与领料;节点顺序 = 快速排产 → 工单排产/预排线 → 产线排产负荷 → 材料出库单;箭头文案与节点说明;截图 `flow-board.png` |
| `_probe-flow-block-jump.mjs` | **15/15**(5173/8090 各一遍) | 四个卡点气泡分别落到 `/prod/plan/orderConvert`、`/prod/plan/scheduleBoard`、`/prod/plan/workOrderList`、`/panelx/list/FINISH_IN`,且目标页根节点在(不是空白面板壳) |
| `frontend` 单测 | 9/9 | `node --test src/core/dashboard/flowSpec.test.js`(新增「排产三节点必须在材料出库单之前」「当前卡点跳转走专页路由」) |
| `DbSync` | 两账套均「执行 1、失败 0」,复跑「执行 0」 | 正式 `HSDZ_MES` + 测试 `HSDZ_MES_TEST` |

## 怎么重跑

```bash
# 接口(只写测试账套;--cleanup 传了才删探针单)
node tools/archive/_picking-flow-20261018/_api-picking-flow.mjs [--cleanup]

# 界面(需 5173 + 8090 都在跑;MES_UI 可切实例)
node tools/archive/_picking-flow-20261018/_probe-flow-board.mjs
MES_UI=http://127.0.0.1:8090 node tools/archive/_picking-flow-20261018/_probe-flow-block-jump.mjs

# 审核/回写实测(会改测试账套数据,结束后用 cleanup 收拾)
node tools/archive/_picking-flow-20261018/_api-audit-picks.mjs CL-2026-10-00xx …
node tools/archive/_picking-flow-20261018/_api-cleanup-picks.mjs CL-2026-10-00xx …
```
