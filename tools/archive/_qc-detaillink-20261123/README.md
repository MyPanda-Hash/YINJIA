# _qc-detaillink-20261123 —— 出货检验明细表:单号可点跳转(2026-11-23)

## 用户口径

> 「1.实现点击对应的单号可以转到对应的单据」(附《出货检验（表观）明细表》截图,红框圈住「工号」列 =
> 工单号 `GD-2026-11-0002` / `GD-2026-11-0012` …)

明细表里两列单号都要能点:

| 点哪 | 跳到哪 | 口径依据 |
|---|---|---|
| **单据编号**(`ZJ-…` / `ZC-…`) | 本行所属的出货检验单:表观 = `QC_ASM_INSP`、功能 = `QC_PROC_INSP`(`/panelx/list/<面板>?docNo=<单号>`) | 与检验数据记录明细表、来料品质流程监控同款 |
| **工单号**(`GD-…`) | 生产工单页 `/prod/plan/workOrderList?keyword=<工单号>&focus=<工单行id>`:定位该工单行 + 自动打开「工单详情 · 追溯」 | 与「生产工序进度看板」点整行同款 |

其余列(检验项目/客户名称/工单行号…)仍是普通文本 —— 只有这两列算链接。

## 落地

- **DB**(`tools/migrate-qc-insp-detail-doclinks-20261123.sql`,幂等,两账套已执行):
  视图 `v_qc_proc_insp_detail` / `v_qc_asm_insp_detail` 尾部补**隐藏列** `[工单行id]` = `plang.id`
  (`OUTER APPLY TOP 1`,按 工单号+工单行号 对上;对不上 = NULL)。
  原因:头表 `qc_*_insp_head` 只有「工单号 + 工单行号」,而生产工单页的精确定位锚点是 `plang.id`。
  `yj_field` 登记 `工单行id`(visible=0 / hidden=1,不进表格列)+ en/zh-TW/ja/ko/es/fr/de/ru/vi/th 译名
  + 视图列 `MS_Description`;`docs/development/数据库表清单.md` 与 `tools/gen/db-catalog-tables.tsv` 已重跑刷新(19→20 列)。
- **前端契约唯一真源** `frontend/src/core/qc/qcInspDetailLinks.js`(纯函数 + 8 条单测):
  `detailLinkKind(panel, column)` 判定哪列算链接;`docJumpTarget(user, panel, docNo)`(过 `canViewPanel`);
  `workOrderJumpTarget(user, docNo, lineId)`(过页面面板 `WORK_ORDER_LIST` 的 `view` 词)。
  无权限/空单号 ⇒ `ok=false` 且**不发路由**,调用方只提示「无查看该面板的权限」。
- **接线** `frontend/src/core/views/PanelxList.vue`:
  报表单元格新增一个 `v-else-if`(`.doc-no-link`),点击走 `openReportLink(row, prop)`。
- **顺带修的坑**(否则点单据编号 = 空白纸面):
  出货检验单/首件检验单的左栏状态页签默认停在「未完成」(`RAIL_STATUS_TABS` 首项),而明细表里要看的
  往往是**已审核**的单 ⇒ `?docNo=` 深链落地后左栏「共有数据 0 条」、纸面全空(实测 `ZJ-2026-11-0009`
  `shr=admin`)。现在 `load()` 里给 `?docNo=` 补了与 `?focus=` **同款的兜底**:目标单不在当前页签时
  退回「全部」再取一次(`docDeepPending` 一次一清,之后用户自己切页签不会被抢回)。

## 取证(ego-browser,5173 源码版;页面登录工厂 = YINJIA-MES·测试库 HSDZ_MES_TEST)

> 两账套都已执行迁移并逐条核对视图列/字段/译名(`q*.sql` 在 HSDZ_MES 与 HSDZ_MES_TEST 上各跑一遍,
> 数值见下方「数据库口径核对」)。**界面取证刻意留在测试库** —— 切登录工厂会把用户当前那套正式账套会话踢下去。
> 正式账套的差异只有数据量(表观 1040 vs 1039 行),前端代码与视图结构两账套一致。

| 脚本 | 结论 |
|---|---|
| `round-01.mjs` + `round-01-list.png` | 表观明细表 100 行;**链接列恰好 = [单据编号, 工单号]**(其余列 `link:false`);`工单行id` 隐藏列不进表格 |
| `round-02.mjs` | 点单据编号 → `#/panelx/list/QC_ASM_INSP`;点工单号 → `#/prod/plan/workOrderList` + 「工单详情 · 追溯」打开 + 当前行 = 被点工单 |
| `round-03.mjs` | 换一行再点(第 3 行 `ZJ-2026-11-0007`):落点面板左栏与纸面都显示该单号 ⇒ **定位到被点那张,不是列表第一张** |
| `round-04.mjs` + `round-04-click-long-wait.png` | 「空白纸面」现象复现 + 修好后同一路径落地(深链与点击都命中 `ZJ-2026-11-0009`) |
| `round-05.mjs` + 4 张 png | A 表观点单据编号 → 出货检验（表观）显示该单;B 表观点工单号 → 生产工单页 trace 打开、current-row 命中;C 功能明细表同款(点单据编号 → 出货检验（功能）显示 `ZC-2026-11-0006`) |
| `round-06.mjs` | 探路(想用「点列头排序」把老单翻到首页定位 NULL 行;排序器只做单页排序,没定位到)⇒ 边界改用 round-08 验 |
| `round-07.mjs` | 排序后表格仍 100 行、链接不丢(点列头排序不影响跳转判据) |
| `round-08.mjs` + png | 边界:工单行id 为 NULL 的老单(`GD-2026-10-0002` 两行 `asp_cancel='Y'`)只带 keyword ⇒ 生产工单页按关键字过滤(该工单已作废故 0 行,不报错) |
| `round-09.mjs` / `round-10.mjs` + png | 探路:左栏页签真实选择器是 `.dsr-tab`(round-09 用 `.doc-status` 打偏,round-10 更正) |
| `round-11.mjs` | **兜底只用一次**:深链落地自动退到「全部」后,用户点「未完成」停在未完成(`hijackedBackToAll:false`)—— 不会被兜底抢回 |

数据库口径核对(`q*.sql`,正式库 + 测试库):两张视图均已有 `工单行id`;
表观明细 1040 行中 14 行 NULL(老单,工单行号=0 / 工单已作废)、其余命中;功能明细 2532 行中 230 行 NULL。
`DbSync` 两账套各「执行 1、失败 0」,复跑 `执行 0 / 跳过 851 / 失败 0`。

## 复跑

```bash
# 迁移(两账套各一次;先正式后测试)
cd tools && YINJIA_SQL_PASS=Yinjia@2026 \
  "C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-insp-detail-doclinks-20261123.sql
YINJIA_SQL_DB=HSDZ_MES_TEST YINJIA_SQL_PASS=Yinjia@2026 \
  "C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-insp-detail-doclinks-20261123.sql

# 单测
cd frontend && node --test --experimental-test-isolation=none src/core/qc/qcInspDetailLinks.test.js

# 页面取证(需 5173 在跑)
"C:/Users/vigna/.local/share/ego/active_version_dir/ego-browser.exe" nodejs \
  -e "await import('file:///C:/Users/vigna/ego/qc-detaillink-20261123/round-05.mjs')"
```
