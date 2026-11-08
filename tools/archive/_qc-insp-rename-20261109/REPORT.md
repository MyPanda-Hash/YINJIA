# 2026-11-08/09 · 制程检验单改名「出货检验单功能」+ 检验方案弹窗列调整 —— 实施与验收记录

## 0. 用户口径(原文)

1. 「制程检验单将名字更改为出货检验功能,修改如图处」+ 追问确认:
   **菜单/页签 =「出货检验单功能」;纸面/记录表标题 =「出货检验记录表」**(左栏选择标题、打印/PDF/Excel 导出标题同步)。
2. 组装成品检验单改名/数据填写表格对齐 —— 用户明确 **「图二和第二点不管先」**(本轮不做)。
3. 「检验方案表格调整,不合格应对措施不显示,检查频率需显示」—— 用户确认:
   **不合格应对措施列从弹窗移除;检查频率列保留,数据源 = 计划表「检测频率」,计划里填了才显示。**

## 1. 改动清单

### 1.1 数据库(两账套均已执行,幂等;`DbSync run` 记账,`yj_schema_log` 已登记)

| 脚本 | 内容 |
|---|---|
| `tools/migrate-qc-proc-insp-rename-20261109.sql` | `yj_panel` 面板名 → 出货检验单功能(+ en);`yj_menu_node` 菜单覆盖行(如有)同步;`yj_translation` panel/report 译名换键;自检项含「物理表/前缀 ZC 未动」「旧名 0 残留」 |
| `tools/migrate-qc-proc-insp-tpl-20261109.sql` | 报表模板入库行改名+正文同步(`yj_report_template.name=出货检验记录表`,XML 标题 `CDATA["出货检验记录表"]`,`update_at` 非空;旧标题 0 残留;2026-11-06「批准」签名格保留)。由 `tools/archive/_gen-qc-proc-insp-tpl-20261109.mjs` 从仓库 `.jrxml` 生成,不手抄 |
| `tools/db-migrations.txt` | 上述两条登记在清单末尾 |

> ⚠ 未改历史迁移脚本字节(DbSync 按内容哈希判重跑);未改物理表/列/面板代号/单据编号前缀 ZC/审批数据/历史单据。

### 1.2 代码

| 文件 | 改动 |
|---|---|
| `frontend/src/business/menus.js` | 菜单 title → 出货检验单功能 |
| `frontend/src/core/qc/QcProcInspSheet.vue` | 纸面标题 / Excel 标题 / sheet 名 / 文件名 / 空值兜底 → 出货检验记录表 |
| `frontend/src/core/qc/qcProcInspExport.js` | Excel 版式默认标题 → 出货检验记录表 |
| `frontend/src/core/qc/QcInspPlanDialog.vue` | **移除「不合格应对措施」列**;检查频率列保留(数据源 `fromShipPlan.检查频率` = 计划表检测频率);注释同步 |
| `frontend/src/core/qc/qcPlanApplicableDocs.js` | 适用单据 label → 出货检验单功能 |
| `frontend/src/core/qc/QcProcInspWoPicker.vue`、`frontend/src/core/views/PanelxList.vue` | 选生产工单提示/回执 toast 里的旧名 → 新名 |
| `frontend/src/core/dashboard/flowSpec.js`、`frontend/src/views/modules/plan/WorkOrderTraceDialog.vue` | 首页流程看板节点名 / 工单追溯说明中的旧名 → 新名 |
| `frontend/src/i18n/locales/en.js` | 新词条(en):出货检验单功能 / 出货检验记录表 / 相关提示与 toast 的英文 |
| 测试 | `qcProcInspExport.test.js`(标题断言)、`qcPlanApplicableDocs.test.js`(适用单据断言)同步 |
| `backend/src/main/resources/reports/qc_proc_insp.jrxml` + `report-templates.properties` | 报表大标题/注册名 → 出货检验记录表(classpath 兜底源,与库内行同源) |

> 动态跟随、未逐处手改:页签/浏览器标题/左栏「XXX选择」/导出文件名/审批通知/参照弹窗显示名都读
> `yj_panel.panel_name`(改库即生效);报表下拉名/文件名读 `yj_report_template.name`。

## 2. 验收结论(全部实测,非预期值)

### 2.1 需求1:改名

| 验收点 | 实测 | 证据 |
|---|---|---|
| 菜单叶子 | 品质管理 → 制程品质 → **出货检验单功能**;全页无「制程检验单」 | ego round-01 `MENU2`;`screenshots/r1-menu.png` |
| 页签 + 浏览器标题 | `出货检验单功能` / `出货检验单功能 · YINJIA-MES` | round-01 `FACTS`;`screenshots/r1-panel.png` |
| 左栏选择标题 | `出货检验单功能选择` | round-01 |
| 纸面标题 | `出货检验记录表` | round-01 `paperTitle`;r1-panel.png |
| 英文语言 | 菜单/页签 `Outgoing Inspection Sheet (Functional)`;纸面 `Outgoing Inspection Record` | round-03 `S2_after_altL2`;`screenshots/r2-en-panel.png` |
| 面板元数据接口 | `getPanelConfig(QC_PROC_INSP).metadata.panelName = 出货检验单功能`,不含旧名 | `api-verify-result.json` |
| 报表模板名 | `/api/report/templates` → `qc_proc_insp / 出货检验记录表` | 同上 |
| PDF 报表大标题 | 导出的 PDF 文本层第 3 行 = `出货检验记录表`,旧标题 0 | `report-ZC-2026-11-0002.pdf` + `.txt` |
| 选生产工单弹窗提示 | 「…生成**出货检验单功能**草稿…」,无旧名 | round-04/05 `WO_PICKER`;`screenshots/r4-wo-picker.png` |
| 两账套 DB | `yj_panel.panel_name=出货检验单功能`、旧名 0;panel/report 译名就绪;模板行 name/正文已换 | `db-evidence/q17-final.sql`(HSDZ_MES / HSDZ_MES_TEST 各跑) |

### 2.2 需求3:检验方案弹窗列调整

| 验收点 | 实测 | 证据 |
|---|---|---|
| 「不合格应对措施」列 | 弹窗表格表头 = 序号/检验项目/检验要求/检验方法/**检查频率**/备注,**无不合格应对措施** | round-09 `FACTS`;`screenshots/r9-plan-dialog-full.png` |
| 「检查频率」显示真实值 | 10/10 行有值:`生产量*1%`、`1PCS/一个生产批次`(计划单 IP-2026-10-0008 的「检测频率」) | round-07/09;r9 截图 |
| 取数链路 | `/api/qc/inspPlan/fromShipPlan?productCode=C-23-11` 返回 10 行、10 行含检查频率 | `api-verify-result.json` |
| 默认页签 | 打开即停在「出货检验计划」页签 | round-01/09 |

> 说明:用户截图所开计划(IP-2026-11-0006 / A-54-08)的「检测频率」本身为空,故线上该单弹窗仍会显示空列 ——
> 已与用户确认数据源口径(「计划里填了才显示」)。本轮用有值的计划(测试库 C-23-11)验证了显示链路。

### 2.3 需求2

**按用户口径「图二和第二点不管先」,本轮未动组装成品检验单**(QC_ASM_INSP 的面板名/纸面/录入表格均保持原样)。
注:需求3的弹窗列调整是**共享组件**,组装成品检验单打开同一弹窗时同样不再显示「不合格应对措施」列。

## 3. 回归与体检

- 前端全量单测:`node --test`(frontend)= **1540 项,pass 1535,fail 5**;5 项失败全部为
  `recordSheetConfigs.livedb.test.js` 的**环境性失败**(本机缺 `SQLCMD.EXE`,连不上活库),与本轮改动无关(改动前同样失败)。
- 两账套迁移**重跑幂等**:两条脚本在两库各再执行一遍 → 均 `[OK]`(5 batches / 2 batches),无报错、无脏写。
- 测试库夹具:为验证「检查频率显示真实值」,临时把测试库草稿单 `ZC-2026-10-0033` 的「产品编码」改为 `C-23-11`
  (该产品有含检测频率的计划);验证完已原值还原为 `T270`(`fixture-set*.sql` / `fixture-restore.sql` 可复跑)。
  **正式库未做任何测试性写操作。**

## 4. 已知边界 / 需要用户知晓

1. **纸面抬头「检验类别:制程检验」保持旧词** —— 「制程检验」是检验类别的**数据存储值**(正式库 432 行),
   按 ADR-0001 数据键不随显示名变化;若要一起改需单独立项(数据迁移 + 代码/排序/看板同步)。
2. **出厂检验报告/不合格报告里的字段「制程检验单号」未改** —— 是字段数据键 + 物理列名(`qc_oqc_head` / `qc_bhg`),
   改动会动结构/参照键,超出「只改显示名」范围(建议不改)。
3. **其他 9 个语言包未手补新词条** —— 本轮按 AGENTS 最低要求交付 **en**(其余语言由 `tt()` 的「缺失→机翻/翻译表」兜底,
   与 2026-10-20「IOT设备配置」改名同口径;旧词条为死键,不影响界面)。
4. **`backend/src/main/resources/static` 未重建** —— 工作区里有另一会话正在重建 static 的未提交改动,
   为避免覆盖对方产物本轮未跑 `npm run build`。**部署前必须重新 build 并同步 static**(或走部署机自带前端构建流程),
   否则服务器/8090 看到的仍是旧前端。
5. 服务端报表模板已写库(DB 优先),**无需重启后端即生效**;仓库 `.jrxml`/`properties` 已同源更新,供新装/兜底使用。

## 5. 证据索引

| 文件 | 内容 |
|---|---|
| `scripts/round-01.mjs` … `round-09.mjs` | ego-browser 复跑脚本(UI:菜单/页签/纸面/弹窗/英文/选生产工单) |
| `screenshots/r1-panel.png` / `r1-menu.png` / `r2-en-panel.png` / `r4-wo-picker.png` / `r9-plan-dialog-full.png` | 对应截图 |
| `api-verify-result.json` | 接口验收(panelName / reportTemplates / fromShipPlan / PDF) |
| `report-ZC-2026-11-0002.pdf` / `.txt` | PDF 标题实测(文本层) |
| `db-evidence/q17-final.sql` + `q11-verify-db.sql` | 两账套 DB 落地查询 |
| `fixture-set.sql` / `fixture-set2.sql` / `fixture-restore.sql` | 测试库夹具与还原 |
| `INVENTORY.md` | 只读盘查清单(改名触点全量,实施前基线) |

## 6. 复跑

```bash
# 两账套迁移(幂等)
cd tools
YINJIA_SQL_DB=HSDZ_MES      java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-proc-insp-rename-20261109.sql
YINJIA_SQL_DB=HSDZ_MES      java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-proc-insp-tpl-20261109.sql
YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-proc-insp-rename-20261109.sql
YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-proc-insp-tpl-20261109.sql

# 页面(源码即时生效)
ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-insp-rename-20261109/round-01.mjs')"

# 单测
cd frontend && node --test src/core/qc/qcProcInspExport.test.js src/core/qc/qcPlanApplicableDocs.test.js
```
