# 巡线检验（QC_LINE_PATROL）· 前端交付与走查证据（2026-11-14）

任务：`task-4`（共享任务板）——巡线检验前端纸面 + PanelxList 接线 + 菜单 + 10 语言包 + ego 真机自测。
契约唯一真源：`docs/design/成型车间巡线记录表-首版.md`（版式/字段/库表，本目录不重复抄）。
纸样原图：`../refs/paper.png`（用户 2026-11-14 给的第二张图，脱模检验记录表 1843×1109）。

## 一、改动文件（全部为前端源码，未碰 static / backend / tools/*.sql / 契约）

| 文件 | 改动 |
|---|---|
| `frontend/src/core/qc/QcLinePatrolSheet.vue` | **新增**。纸面组件：根类名 `.lp-sheet`；props `head/fields/editable`、emit `dirty`；大标题 + 左「日期」(草稿态 date-picker) + 右「审核人」(只读)；**12 列表头**（列序照纸样）；每块 **4 子行**（编号①/型号① + 长度·内径·重量 三组标准值/实测；编号②/型号② 同构）；块级 8 列 **rowspan=4**；每块右侧「＋插入本块之后 / ×删除本块」(`no-print`)；空草稿自动铺 **3 块**；空表给「＋ 新增巡线记录」；草稿态全格可填、只读态全文本；`@media print` 白名单（含 `@page size: A4 landscape`） |
| `frontend/src/core/views/PanelxList.vue` | ① import `QcLinePatrolSheet`；② `approval-layout` 里加 `v-else-if="panelCode === 'QC_LINE_PATROL'"`；③ `isApprovalDoc` 名单加 `QC_LINE_PATROL`（否则退回「表头字段平铺+明细表格」数据页、侧栏无打印）；④ 导出/打印两处纸张根类名兜底名单加 `.approval-layout .lp-sheet`（`collectSheetShots` 与 `printApprovalSheet` 的 `paperEl`）；⑤ `SHEET_PREVIEW_PANELS` 加 `QC_LINE_PATROL`（**Lead 2026-11-14 补充口径**：没有服务端 jrxml ⇒ 不加会去拿通用字段流水报表）；⑥ `DOC_RAIL_PANELS` 加 `QC_LINE_PATROL: []`（左「单据选择」栏：单号\|日期\|审核状态；中间列留空——车间/巡线人员是**明细列**，列表行上没有这两个键） |
| `frontend/src/business/menus.js` | 品质管理 → 制程品质 组，在「出厂检验报告」之后加 `巡线检验`（`qcLinePatrol` / `/panelx/list/QC_LINE_PATROL` / panelCode `QC_LINE_PATROL`） |
| `frontend/src/business/menus.test.js` | 制程品质组现役面板断言由 4 张改 5 张（加 `QC_LINE_PATROL`） |
| `frontend/src/i18n/locales/{zh-TW,en,ja,ko,es,fr,de,ru,vi,th}.js` | biz 各加 **18 条**文案（zh-CN 为源语言不重复插），脚本 `_add-line-patrol-i18n.mjs`（幂等，已存在跳过） |
| `tools/archive/_qc-line-patrol-20261114/ui/**` | 本证据目录（脚本/截图/DB 取证/README） |

`npm run build`：**通过**（vite build ✓，最后一次含列宽微调后的构建）。

## 二、菜单路径

**品质管理 → 制程品质 → 巡线检验**（该组叶子顺序：首件检验单 / 出货检验单功能 / 出货检验表观 / 出厂检验报告 / **巡线检验**）。
英文界面：**Quality → Process Quality → Line Patrol Inspection**。

## 三、ego-browser 走查脚本与截图

脚本原位置 `C:/Users/vigna/ego/qc-line-patrol-20261114/`（本目录为拷回仓的同一份，可复跑：
`ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-0N.mjs')"`）。
登录：`admin/123456`；**登录工厂**按脚本里的下拉选择（YJ=正式库 / YJ_TEST=测试库）。

| 轮次 | 做的事 | 结论（关键输出） |
|---|---|---|
| round-01 | 面板打开 / 侧栏「新增」 | 空面板：12 列头齐、`暂无巡线记录`；新增后 `rows=12`（3 块×4 子行）、`blockCells=24`（每块 8 个 rowspan=4 格）、`prodCells=48`、可填框 72 → 截图 `round-01-01/02` |
| round-02 | 逐格填写（3 块共 24 字段）→ 保存 → **刷新** → 菜单进入 | 填完 24 字段无 miss；保存后值在；`page.reload()` 后值**仍在**（真落库）→ 截图 `round-02-01/02/03` |
| round-03 | 菜单路径走查 + 打印白名单 + **英文**走查 | 菜单叶子 `["首件检验单","出货检验单功能","出货检验表观","出厂检验报告","巡线检验"]`，点进落 `#/panelx/list/QC_LINE_PATROL` 且值仍在；en 下标题/日期/审核人/12 列头/侧栏按钮全英文（`Forming Workshop Line Patrol Record` / `Patrol Time` / `…`），菜单 `Line Patrol Inspection` → 截图 `round-03-01/02` |
| round-04 | 增块/删块 + 空表 + 打印媒体 + 二次保存 | 「＋」在第 2 块后插入一块（4 块、值顺序 `08:30/10:30/''/13:30`）；「×」删掉后回到 3 块、原值不动；再存+刷新仍 12 行；删光 3 块 → 空表 `＋ 新增巡线记录` → 点它补 1 块并保存成功（第二张单：1 块落库）→ 截图 `round-04-01..04` |
| round-05 | 左「单据选择」栏切单 | 左栏列出 `XJ-…0002 / XJ-…0001`（单号\|日期\|草稿），点行即切：`inputs 25 → 73`、`rows 4 → 12` → 截图 `round-05-01/02` |
| round-06 | 侧栏「打印」不空白（Lead 补充点 2） | 把 `window.print` 换成探针后**真点**「打印」：`printCalled=true`、`body.approval-printing=true`、`--print-zoom=0.814`；模拟 print 媒体下 `.lp-sheet` `visibility=visible / position=static / border=0 / 962px`，表体字号 9px，行操作列 `display:none` ⇒ **不会空白页、编辑控件不上纸** → 截图 `round-06-01` |
| round-07/08/09 | 「导出报表 → 打印预览」（Lead 补充点 1） | 弹窗文案已换成「按当前单据的纸张版式生成（与「打印」同一份渲染，所见即所得）」（`SHEET_PREVIEW_PANELS` 生效）；点「打印预览」**真的新开一个标签页**，URL 为 `blob:http://localhost:5173/…`，`fetch` 回读 **`%PDF-1.3`、97 KB**（round-09；round-13 复跑 154 KB），截图里就是这张纸（含 `15:00 / CR-101 / A-200` 等值），不是字段流水报表 → 截图 `round-09-01` / `round-13-01` |
| round-11 | **只读态**（临时把测试单置为已审核，随后还原并清理） | 左栏显示 `已审核`；纸面 `is-editing=false`、`inputs=0`、`spans=24`、行操作列消失、保存按钮不出现；只读文本 `编号： CR-101 / 实测： 112.2 / …` → 截图 `round-11-01` |
| round-12/13/14 | ⚠ 踩坑轮（**勿照抄**） | 想切测试库时按「第一个 `.el-select`」点，实际点到了**语言切换器** ⇒ 又登进正式库并造了一张单（已清理，见 §五）。round-15 改为按 `el-form-item` 的 label「登录工厂」定位下拉 |
| round-15 | **测试库（YJ_TEST / HSDZ_MES_TEST）** 最终复核 | `factory={code:'YJ_TEST',name:'YINJIA-MES·测试库'}`；空面板 → 新增 3 块(12 行/72 框) → 填 24 字段 → 保存 → 刷新值仍在；车主「成型一车间」格宽 **81px**、输入不截断（列宽微调生效）→ 截图 `round-15-01/02/03` |

截图清单（与脚本同名）：`round-01-01/02`、`round-02-01..04`、`round-03-01/02`、`round-04-01..04`、`round-05-01/02`、`round-06-01`、`round-07-02`、`round-09-01`、`round-11-01`、`round-13-01`、`round-15-01..03`。

## 四、落库取证（DB）

`db-stored-HSDZ_MES.txt`（走查当时，正式库；**该数据已按 Lead 要求清理，文本留档**）：

- `qc_line_patrol_head`：`XJ-2026-11-0001 / 2026-11-14 / 创建人 admin`、`XJ-2026-11-0002 / 2026-11-14 / admin`；
- `qc_line_patrol_detail`：0001 三块（行号 1/2/3），逐格与界面输入逐字一致（`08:30/成型一车间/CR-001/A-100/112.0/112.1/8.0/8.05/5.0/5.02/CR-002/A-101/112.0/111.9/8.0/7.98/5.0/4.99/1.02/无粘模/合格/合格/合格/张三` …），0002 一块；
- 元数据就绪体检：`db-probe-readiness-HSDZ_MES.txt`（面板 1、两表在、detail 32 列 / head 12 列）、`db-probe-metadata-HSDZ_MES.txt`（header 5 字段 / detail 25 字段（含 行号 hidden=1）/ `yj_role_panel` 13 行 / 译名 en 有）。

两账套收尾对账（`db-final-both-accounts.txt`，`probe-both-dbs.sql` 两个库各跑一次）：

| 库 | head | detail | yj_doc_status | 说明 |
|---|---|---|---|---|
| `HSDZ_MES`（正式库） | **0** | **0** | **0** | 走查测试单已清零（`XJ-2026-11-0001/0002/0003`） |
| `HSDZ_MES_TEST`（测试库） | 1 | 3 | 1 | round-15 的 `XJ-2026-11-0001`（草稿，行号 1 有值、2/3 是默认铺的空块） |

`yj_doc_status` 对新面板**可写**已确认：通用保存路径自动插行（`panel_code=QC_LINE_PATROL, doc_no=XJ-…, saved='Y'`），
左栏「审核状态」与只读态判定都读它（round-11 把 `shr` 置 admin 后界面即显示「已审核」、纸面转只读，随后还原）。
⚠ 该表没有「单据编号」列（是 `panel_code / doc_no / shr / shsj / saved / archived / canceled …`）——第一版探针按中文列名查报
`Invalid column name` 是**列名写错**，不是编码问题；`probe-doc-status.sql` 已改成 ASCII 列名版。

## 五、正式库清理（Lead 2026-11-14 要求）

`cleanup-prod-test-docs.sql`（幂等；链路口径照 `tools/archive/_inv-proc-insp-20261114/cleanup-manual.sql` 与
`tools/archive/_first-insp-daily-20261112/_cleanup.sql`）：明细 → 头 → `yj_doc_status` → `form_flow_link`（占用链）→
`yj_usage_log` → `yj_attachment`；号池 `s_allno` 不回退。

`db-cleanup-HSDZ_MES.txt` 实测：清理前 `detail 3 / head 1 / docstatus 1 / usagelog 1`，清理后**全 0**；
全表自检 `head_total=0 / detail_total=0 / docstatus_total=0` ⇒ **正式库已清零（两表 COUNT(*)=0）**。
（`XJ-2026-11-0001/0002` 首轮造；`XJ-2026-11-0003` 是 round-12/14 误登正式库时又造的，一并清掉。）
后续自测一律走测试库（round-15 起）。

## 六、多语言

- 组件/菜单新文案全部走 `tt()`；10 个语言包 biz 各 +18 条（脚本 `_add-line-patrol-i18n.mjs`，幂等）。
- en 走查（round-03）：纸面标题/日期/审核人/12 列头/「增删」/侧栏按钮/左栏/菜单叶子**全英文**，无裸中文。
- **业务事实数据不翻译**（ADR-0001）：`成型一车间`、`无粘模`、`合格`、`CR-101` 这类用户输入/单据值在 en 界面照原样显示——这是规范要求，不是漏翻。
- 字段标签/面板名另有 `yj_translation`（DB 侧，patrol-db 已插 en），两条路径一致。

## 七、遗留 / 未做项

1. **本期不做审批流**（契约 §一「先可填即可」）⇒ `审核人 / 审核时间` 恒只读空白，侧栏无「提交审批」；
   单据状态永远停在草稿（只读态是用 DB 临时置 `shr` 验证的，已还原）。
2. **不做导出 Excel**（契约口径）：侧栏「导出 → 导出 Excel」当前走通用「表头 + 全明细」导出，不是纸面版式；
   后续若要受控表单版 Excel/PDF，需服务端 jrxml（本任务范围外）。
3. 左栏「单据选择」无状态页签（未完成/已完成/全部）——那需要后端 `QueryService.STATUS_TAB_PANELS` 登记，本任务不碰后端。
4. 左栏中间列留空：`车间 / 巡线人员` 是明细块级列，列表行（表头字段）上取不到；要显示须后端下发聚合列。
5. 打印为浏览器打印（`@media print` 白名单已验）；`@page size: A4 landscape` 与首件单的 `@page margin` 分属不同属性，互不覆盖。
6. 8090（jar 内 static）**未同步**：本次只改前端源码，按 Lead 统一「build → static 同步 → jar 重打包 → 重启」流程发布；
   本地验证一律在 5173（vite 源码即时生效）。

## 八、环境与踩坑（给下一个人）

- **登录工厂下拉**：登录页有多个 `el-select`（语言切换器排在前面）⇒ 必须按 `el-form-item` 的 label「登录工厂」定位，
  且点击前等它 `not.is-disabled`（工厂列表在异步加载）；选完**回读**下拉文本确认是「YINJIA-MES·测试库」再动单据（round-12/14 就是没回读才误登正式库）。
- **含中文的 SQL 探针**：命令行带 `-Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8`，SQL 从 UTF-8 文件读（`SqlRunner.java`），别把中文内联进 shell 参数。
- 打印/预览取证：不要真去点系统打印对话框；把 `window.print` 换成探针 + `Emulation.setEmulatedMedia({media:'print'})` 量 computed 样式即可；
  「打印预览」的新窗口要**先轮询 `task.tabs()` 到 `blob:` 出现**再取（`window.open('')` 先生成 about:blank，PDF 生成完才写 href）。
