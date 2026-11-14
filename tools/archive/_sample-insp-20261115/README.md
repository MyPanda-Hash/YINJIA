# 样品检验:送样登记表 + 检验委托单(2026-11-15)

| 属性 | 内容 |
|---|---|
| 需求 | 用户 2026-11-15:① 两张单放「品质管理」下新增一列「样品检验」;② 检验委托单为主要实际单据,纸面照 .doc 一比一,「检验类别」处带入送样登记表内容,要有基础审批流程;③ 送样登记表 = 检测目录 + 委托单的引用源,作为查询目录,也要能正常添加其他项;④ 两单不与其他单据发生关系,两张表互联即可。 |
| 源文件 | `送样登记表-上系统的20261110.xls`(内部检测目录 43 行)/ `水家电综合检测中心 检验委托单(委托检验合同).doc`(YJ-QP-701-1-01 (00)) |
| 唯一设计真源 | [docs/design/检验委托单-首版.md](../../../docs/design/检验委托单-首版.md) |
| 迁移脚本 | `tools/migrate-sample-insp-20261115.sql`(已登记 `tools/db-migrations.txt`;两账套已执行,复跑幂等) |
| 面板 | `SAMPLE_REG`(送样登记表,archive)/ `INSP_COMMISSION`(检验委托单,doc,前缀 **WT**) |
| 表 | `qc_sample_reg`(16 列,44 行种子)/ `qc_insp_commission_head`(38 列)/ `qc_insp_commission_detail`(17 列) |
| 前端 | `frontend/src/core/qc/InspCommissionSheet.vue`(纸面)/ `frontend/src/core/qc/SampleCatalogPickDialog.vue`(目录选择)/ `PanelxList.vue` 三处接线 / `menus.js` 新分组 / `i18n/locales/en.js` 71 条词条 |

## 本目录证据

| 文件 | 说明 |
|---|---|
| `Q.java` / `q*.sql` / `v1.sql` | 只读 JDBC 探针:面板/字段/种子/授权/译名/列数核对 |
| `probe-api.mjs` | 8090 现役实例上两个面板的 config/query 探针(两账套) |
| `probe-flow.mjs` | **后端流程 E2E(测试账套)**:新增→保存(带 3 个目录项目)→读回→提交审批→审批通过→留痕→弃审,**16/16 PASS** |
| `probe-defaults.mjs` | 新建单默认值探针(样品处理方式/判定规则/报告有效期 + 单据日期) |
| `probe-catalog-maintain.mjs` | **送样登记表可维护性**:新增一行(45 行)→按收费 label 落库校验→作废回 44 行,**7/7 PASS** |
| `cleanup-test-data.sql` | 清掉联调产生的 WT-* 单与临时目录行(仅测试账套可执行;号池 s_allno 保留) |
| `ui/round-*.mjs` + `ui/round-*.png` | ego 浏览器走查脚本与截图(见下) |
| `ui/round-19-print.pdf` + `ui/round-19-print-page1.png` | **真实打印输出**(`Page.printToPDF`,等价打印预览):A4 竖版 **1 页** |

## UI 走查(ego 浏览器,5173 源码版,测试账套 YJ_TEST)

> 本机 2026-11-15 凌晨浏览器 `Page.captureScreenshot` 一直超时(窗口/合成器不可用),
> 改用**页面内 modern-screenshot(domToPng)栅格化**取证;`Page.printToPDF` 仍可用 ⇒ 打印件是真实渲染。

| 轮次 | 验了什么 | 结果 |
|---|---|---|
| round-11 | 新增→「选择检验项目」弹窗(44 项目录)→勾 3 项带入 → 填表头 → 保存 → 提交审批 → 审批通过 → 审批情况 → 只读态 | 全通过:WT-2026-11-0010;检验类别=锂、钠、镁;合计收费 300.00;状态 草稿→审批中→已审核;审批留痕 SUBMIT/APPROVE;审核后 `editableInputs=0` |
| round-12 | English 界面 | 面板/字段/按钮全英文;仅**业务数据**保留中文(客户名/样品名/检测元素/测试周期),符合 ADR-0001 |
| round-14/15/18 | 打印态盒模型 | 打印高 889px < A4 内容高 1062px ⇒ 一页;无元素越界 |
| round-19 | 真实打印 PDF | **1 页 A4 竖版**,版式与 .doc 原件一致 |
| round-21 | 送样登记表面板 | 44 行、列头含「收费（一个样/元）」、合计 4850、新增/保存/删除/打印可用 |

## 打印纸向(踩坑,已修)

`QcLinePatrolSheet` 在全局声明了 `@page { size: A4 landscape }`;`@page` 不认类选择器、也无法按面板条件化。
本纸若是裸写 portrait 会与全局规则互相覆盖 ⇒ 实测**横向裁半张 + 多出空白第 2 页**;
而「具名页」(`page: 名字`)在嵌套元素上又会多一张空白页。
最终口径:**由打印入口动态注入** `@page { size: A4 portrait; margin: 8mm }`
(`PanelxList.printApprovalSheet` 里对 `.ic-sheet` 分支,`afterprint` 移除,与样品申请单 sg-table 同一套做法)
⇒ 实测打印 1 页竖版。

## 数据键口径(重要)

`yj_field` 里「收费」的 **label = 收费（一个样/元）**、物理列 = `收费`。后端 `labelsToCols` 按 **label** 认载荷键
⇒ 前端纸面向后端提交时必须带 `收费（一个样/元）` 这个键(纸面同时双写 `收费`,后端只认 label、不会脏库)。
`probe-catalog-maintain.mjs` 用两种键做过对照:只写 `收费` 会丢值,写 label 才落库。
