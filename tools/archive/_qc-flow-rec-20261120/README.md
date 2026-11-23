# 来料品质流程监控重构 + 三处界面口径(2026-11-20)

用户 4 条口径里**第 1 条(商品「是否过程检验」→ 按出货控制计划判是否检验)待用户给截图确认口径后再做**,
本目录是第 2/3/4 条的取证。

## 改了什么

| # | 口径 | 落点 |
|---|---|---|
| 2 | 来料检验单左栏:供应商下线,改显示 物料编码 / 物料名称 | `PanelxList.DOC_RAIL_PANELS.QC_INSP` + 新纯函数 `core/panel/docRailDetail.js`(明细派生列) |
| 3 | 出货检验（功能）左栏:产品名称 → 产品编码 | `DOC_RAIL_PANELS.QC_PROC_INSP` |
| 4 | 品质流程监控 → **来料品质流程监控**;检验数据记录与来料检验单**并列**;采购入库要两单都审核 | `QcFlowService`(取数/环节) + `qcFlow.js`(节点) + `QcFlowMonitor.vue`(并列版面/列表列) + 菜单/路由/PagePanelRegistry + 译名/菜单覆盖层迁移 |

## 判据(可复跑)

- 前端单测:`node --test --experimental-test-isolation=none frontend/src/core/qc/qcFlow.test.js`
  (21 例)、`.../src/core/panel/docRailDetail.test.js`(5 例)、`.../src/core/views/railStatusTabs.test.js`(5 例)全过。
- 后端接口探针(只读):`java -cp "backend/target/classes;<target/cp.txt>" tools/archive/_qc-flow-rec-20261120/QcFlowProbe.java HSDZ_MES`
  —— 515 行里 17 行带检验数据记录、17 行两单都已审且环节已离开「检验」;
  「检验单已审但记录缺 ⇒ 停在检验」= 0 行(存量无因此卡住的批次)。
- HTTP 探针(`probe-api.mjs` / `probe-api2.mjs`):`检验数据记录单号/日期/状态/结论` 四个键齐全;
  `状态=未完成` 460 行、`仅需检验` 5 行。
- 界面(ego):`round-03/04/05/10.mjs`(截图本地 `C:/Users/vigna/ego/qc-flow-rec-20261120`,
  `*.png` 不入库):
  - 03:标题「来料品质流程监控」;
  - 04:主链中间格 = 来料检验单 + 检验数据记录**两行并列**(都带单号/状态/日期),
    点记录节点跳 `#/panelx/list/QC_INSP_REC` 并打开对应那张检验报告(纸面来料检验单号对得上);
    列表视图多出「检验数据记录」列(值 `JYSJ-2026-10-0102 已审核`);
  - 05:来料检验单左栏列头 = 单号|日期|物料编码|物料名称|采购订单号|批次号|审核状态(无供应商),
    多物料单显示 `Y-S-N / Y-S-Z`;出货检验（功能）左栏 = 单号|日期|工单号|**产品编码**|审核状态;
  - 10:中间格几何取证 —— slot 168px,两个节点各 168px、左对齐、上下叠放(y=320/399)。

## 迁移

`tools/migrate-qc-flow-rename-20261120.sql`(已登记 `tools/db-migrations.txt`,两账套均已执行):
panel 级译名整体改名 + 10 语种定稿 + `yj_menu_node` 覆盖行(测试库有 222 行覆盖,正式库 0 行)。

## 第二轮:并行版面规整(2026-11-20 下午,用户口径「这个的形式太混乱了,要求并行的情况下要规整」)

第一版并列格只是"上下叠两个盒子",实测三处错位:
送料/采购入库贴顶、中间格比它们高一倍、箭头落在两盒接缝上。

修法(`QcFlowMonitor.vue` CSS,零逻辑改动):

| 项 | 改法 |
|---|---|
| 三格对齐 | `.qcf-lane { align-items: center }`(原 `stretch`)—— 送料 / 中间格 / 入库 共用一条中线,箭头也走中线 |
| 两单等高等宽 | `.qcf-slot.is-par { display:grid; grid-auto-rows:1fr }` —— 检验单有「合格 100」数量行、记录单没有,不拉平就一高一矮 |
| 一组视觉 | `.qcf-slot.is-par` 外套 1px 浅色描边(+6px 内边距、180px 宽),箭头连的是"检验这一组"而不是某个盒子 |

取证 `round-11/12/13.mjs`:三格中线同一 cy=405、两节点各 166×75、`equalSize=true / centred=true`、
节点 `scrollHeight == clientHeight`(无文字裁切);特写 `13-parallel-closeup.png`。

## 遗留

- 第 1 条:等用户指出《出货检验计划表》里「表观/功能」标在哪一列(截图)。
- 采购入库单本身的**硬闸门**未加(现状只有「待检验目录·完成」按钮校验两单已审);
  监控页的「当前环节=检验」已按两单都审来判。要不要把「入库单审核」也硬卡住,待用户拍板。
