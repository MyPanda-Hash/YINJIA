# 改名盘查清单：制程检验单 → 出货检验单功能 / 制程检验记录表 → 出货检验记录表

> 任务：`task-1`（qc-rename-scout，只读盘查）· 时间：2026-11-09 · 仓库：`D:\workspace\yinjia`
> **扫描基线 = 2026-11-09 00:03–00:10 的工作区内容**（本清单的行号均按该基线；此后工作区出现**并发实施改动**，
> 部分文件已被另一批改动修改、行号发生漂移 —— 见 §10 快照与「已完成/仍待改」对照，请以 §10 为准核对进度）。
> 约束：未改任何源码/配置/数据库/文档，未 git 操作（仅只读 `git status`/`git diff` 观察），未启停服务；
> 本次仅新增本文件与 `.tmp/insp-rename-20261108/r1~r7-*.sql`（只读 SELECT）及其输出 `r1~r7-*.out.txt`。
> 盘查范围：`frontend/src`、`backend/src/main/java`、`backend/src/main/resources/reports`、
> `frontend/src/i18n/locales`、两账套 DB（HSDZ_MES / HSDZ_MES_TEST）。
> 排除：`node_modules`、`backend/src/main/resources/static`（构建产物）、`frontend/dist`、`tools/archive`、`.tmp`。

## 结论速览（三档计数）

| 档位 | 条数 | 内容 |
|---|---|---|
| **必须改** | **39** | 前端可见文案 16 · i18n 语言包 15 · 测试同步 2 · 资源（properties/jrxml）2 · 数据库 4 |
| **可选** | **8** | 代码注释/DB 注释/孤儿译名（改不改都不影响界面验收） |
| **建议不改** | **7** | 数据键（检验类别取值、制程检验单号字段）、面板码/表名/API、历史迁移脚本、docs、static、历史日志 |

关键结论（供 Lead 定实施面）：

1. **后端 Java 没有任何用户可见的「制程检验单/制程检验记录表」硬编码文案**（68 处命中全是注释或「检验类别=制程检验」这类数据键取值）。面板显示名/报表名/导出文件名都是**动态取元数据**，所以后端口径只需改 DB（+ resources 注册表兜底）。
2. 显示名真源链：**页面标题/页签/左侧目录/导出文件名/审批通知 = `yj_panel.panel_name`**（PanelRegistry→PanelConfigService.metadata.panelName）；**报表下拉名/PDF·XLSX 文件名 = `yj_report_template.name`**（DB 优先，classpath `report-templates.properties` 兜底）；**PDF 上的大标题 = jrxml 内 staticText 字面量**（DB 行内 XML 与仓库 `.jrxml` 必须同源）。
3. 菜单名真源：`frontend/src/business/menus.js:571`（DB 菜单覆盖表 `yj_menu_node` 当前 **0 行**，即没有「菜单设计器」覆盖，改代码即生效；见 §5.5）。
4. 纸面/导出/报表共 **9 处必须改的「制程检验记录表」标题字面量**（Vue 纸面 1 + 空值兜底 1 + 导出标题 1 + Excel sheet 名 1 + 导出文件名 1；导出纯函数默认值 1；jrxml 标题 1；properties 注册名 1；DB 模板行 name 1），另加 **2 个测试文件（3 处断言）** 同步；漏一处就会在导出件/模板上露出旧名。
5. 最大冲突点：**「制程检验」是检验类别存值（432+32 行存量数据）、「制程检验单号」是物理列名/数据键**——按 ADR-0001 属「数据键永不随显示名变化」，本次**建议不改**；但改了面板名后，纸面抬头「检验类别：制程检验」仍会显示旧词，**需用户确认是否接受**（见 §8）。

---

## §0 改名后「自动生效 vs 必须手改」传播链（重要，决定改动面）

改名后**自动跟随**（无需逐处改，靠 `yj_panel.panel_name` 改一行即全部生效）：

| 位置 | 代码证据 | 说明 |
|---|---|---|
| 页签/页面标题 | `PanelxList.vue:9853` `panelName.value = cfg?.metadata?.panelName`；`:9855` `document.title`；`:9858` `curTab.title` | 浏览器标题也会变 |
| 顶部单据 chip / 左侧目录标题 | `PanelxList.vue:49` `{{ panelName }}`；`:258` `{{ tt(panelName) }}`；`:5543` `railTitle(panelName)` | 左侧「制程检验单选择」→ 新名+选择 |
| 列表页导出文件名（Excel/CSV/PDF） | `PanelxList.vue:7659/7766/7922/9809/9833/10105` `${panelName.value}-…` | 自动用新名 |
| 审批/消息通知里的 `{panelName}` | 后端 `ButtonService.java:6425/6444/6467/6513/6596/6600` 等 `def.name()`；`MessageService.panelNameOf` | 自动用新名 |
| 参照弹窗（如 QC_BHG 参照 QC_PROC_INSP） | `QueryService.java:541` `translations.scope(locale,"panel").getOrDefault(def.name(), def.name())` | 自动用新名 |
| 使用日志 `yj_usage_log.panel_name` | 动态写入 | 历史行保留旧名（不改） |
| 报表下拉名 / 报表文件名 | `ReportService.java:301` `m.put("name", t.name())`；`PanelxList.vue:1863` `:label="t.name"`；`:8324` 文件名用 `t.name` | 需改 `yj_report_template.name`（DB）与 properties 兜底 |

**不会自动跟随、必须手改**：`menus.js` 菜单标题、Vue 纸面/导出标题、i18n 词条、jrxml 标题、DB 元数据（panel_name/译名/模板行）。

---

## §1 前端源码中的旧名（用户可见点优先）

搜索命令（全文一致）：
```
rg -n '制程检验单|制程检验记录表|制程检验' frontend/src
  -g '!node_modules' -g '!backend/src/main/resources/static' -g '!frontend/dist' -g '!tools/archive' -g '!.tmp'
```
命中 **28 个文件 / 217 行**；其中**用户可见 16 处**（下表 M1–M16），其余为注释/测试（见 §6）。

### 1.1 必须改（16 条）

| # | 文件:行号 | 现文案 | 建议 | 说明 |
|---|---|---|---|---|
| M1 | `frontend/src/business/menus.js:571` | `{ code: 'qcProcInsp', title: '制程检验单', path: '/panelx/list/QC_PROC_INSP', … }` | **菜单名 → 「出货检验单功能」**（用户原话） | 左侧导航/顶栏单据查询/页签/菜单设计器共用；`LeftNav.vue:38/68`、`TopBar.vue:95`、`TabsBar.vue:12` 均 `tt(title)` |
| M2 | `frontend/src/core/qc/QcProcInspSheet.vue:38` | `<div class="qr-title">{{ tt('制程检验记录表') }}</div>` | **纸面标题 → tt('出货检验记录表')** | 页面纸张大标题（屏幕/打印/打印预览都取这） |
| M3 | `QcProcInspSheet.vue:435` | `const name = String(props.head?.['单据编号'] \|\| props.head?.['编号'] \|\| '制程检验记录表')` | 兜底字面量 → `'出货检验记录表'` | 单号为空的兜底，会进文件名/副标题 |
| M4 | `QcProcInspSheet.vue:438` | `title: tt('制程检验记录表'),` | → `tt('出货检验记录表')` | 导出 Excel 大标题 |
| M5 | `QcProcInspSheet.vue:479` | `XLSX.utils.book_append_sheet(wb, ws, tt('制程检验记录表').slice(0, 28))` | → 新名 | **Excel sheet 名**（用户可见的页签名） |
| M6 | `QcProcInspSheet.vue:480` | `XLSX.writeFile(wb, \`${tt('制程检验记录表')}-${name}.xlsx\`)` | → 新名 | **导出文件名** |
| M7 | `frontend/src/core/qc/qcProcInspExport.js:62` | `export function buildProcInspExport({ title = '制程检验记录表', … })` | 默认值 → `'出货检验记录表'` | 版式单一真源；组件总传 title，但这是**唯一的默认值**，必须同步（测试钉了它） |
| M8 | `frontend/src/core/views/PanelxList.vue:8858` | `tt('未生成制程检验单')` | 「未生成出货检验单」（措辞见 §8.3） | 「选生产工单」回执 toast |
| M9 | `PanelxList.vue:8861` | `tt('该工单行已有制程检验单')` | 「该工单行已有出货检验单」 | toast |
| M10 | `PanelxList.vue:8862` | `tt('已生成制程检验单')` | 「已生成出货检验单」 | toast |
| M11 | `frontend/src/core/qc/QcProcInspWoPicker.vue:34` | `tt('选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。')` | 句中旧名 → 新名（整句改键 + 译名） | 「选生产工单」弹窗提示 |
| M12 | `QcProcInspWoPicker.vue:237` | `tt('生成制程检验单失败')` | 「生成出货检验单失败」 | 建单失败报错 |
| M13 | `frontend/src/core/qc/QcInspPlanDialog.vue:42` | `tt('方案按「适用单据」分套：首件检验单 / 制程检验单 / 组装成品检验单各看自己适用的方案；…')` | 句中旧名 → 新名 | 「检验项目维护」弹窗提示 |
| M14 | `frontend/src/core/qc/qcPlanApplicableDocs.js:10` | `{ value: 'QC_PROC_INSP', label: '制程检验单' },` | label → 新名（建议「出货检验单」，见 §8.3） | 「适用单据」下拉/列表显示，`QcInspPlanDialog.vue:247` `:label="tt(d.label)"`；`docLabelsOf` 也用它 |
| M15 | `frontend/src/core/dashboard/flowSpec.js:151` | `name: '制程检验单(成型产出)'` | → 「出货检验单功能(成型产出)」或「出货检验单(成型产出)」（见 §8.3） | 首页「生产流程/品质与入库」看板节点名，`en.js:4405` 有对应词条 |
| M16 | `frontend/src/views/modules/plan/WorkOrderTraceDialog.vue:191` | `tt('成型出首件检验单与制程检验单，组装出组装成品检验单；切炭/混料/装箱不出检验单')` | 句中旧名 → 新名（措辞待定） | 工单追溯弹窗·质检段说明；`en.js:675` 有对应词条 |

### 1.2 动态跟随（**不要**手改，改 DB `panel_name` 即生效）

| 文件:行号 | 现状 | 说明 |
|---|---|---|
| `PanelxList.vue:49` | `{{ panelName }}` 单据 chip | 来自 `metadata.panelName` |
| `PanelxList.vue:258/688` | 侧栏/页签标题 | `:258` 走 `tt(panelName)` |
| `PanelxList.vue:5558` | `railTitle(panelName.value)`（左侧「xxx选择」） | 依赖新面板名 + `tt('选择')` |
| `PanelxList.vue:7659/7766/7922/9809/9833/10105/10261` | `panelName` 拼导出名/页签名 | 自动 |
| `PanelxList.vue:9853-9858` | `document.title`/`curTab.title` | 自动 |
| `PanelxList.vue:7902` | `QC_PROC_INSP: 'exportProcInspExcel'` 路由映射 | 面板码不变，无需改 |
| 报表下拉（`PanelxList.vue:1860-1863`）+ 报表文件名（`:8324`） | 取自 `/report/templates` 的 `t.name` | 改 DB/模板注册名即生效 |

### 1.3 不在本节的（注释/测试）→ 见 §6

`PanelxList.vue` 另有 30 处、`QcProcInspSheet.vue` 8 处等命中的都是**注释**，不显示给用户，见 §6.1/§6.2。

---

## §2 后端 Java 中的旧名

搜索：`rg -n '制程检验单|制程检验记录表|制程检验' backend/src/main/java` → **68 行**。
逐条判定后：**用户可见文案 0 处；报表名/导出文件名 0 处硬编码**（全走 DB/注册表）；其余为注释或「检验类别」数据键。

### 2.1 数据键取值（**建议不改**，见 §8.1）

| 文件:行号 | 代码 | 说明 |
|---|---|---|
| `QcInspAutoService.java:254` | `head.put("检验类别", "制程检验");` | 自动出单写入的**存储值** |
| `controller/QcProcInspController.java:181` | `head.put("检验类别", "制程检验");` | 人工建单写入的**存储值** |
| `WorkOrderInspectionService.java:48` | `new InspPanel("QC_PROC_INSP", "制程检验", …)` | 输出「检验类型=制程检验」（看板/追溯） |
| `WorkOrderInspectionService.java:55` | `OP_TYPES.put("成型", List.of("首件检验", "制程检验"));` | 应检工序→检验类别 |
| `ScheduleBoardService.java:122` | `"QC_PROC_INSP", new InspSpec(…, "制程检验")` | 追溯「检验类型」输出 |
| `ScheduleBoardService.java:1373` | `List.of("首件检验", "制程检验", "组装成品检验")` | 排序用类型名（与存量数据值对齐） |
| `OqcReportService.java:160` | SQL 列名 `制程检验单号` | qc_oqc 表的**物理列**（见 §8.2） |

### 2.2 注释（**可选**，不显示给用户；建议本任务不改，避免无意义 diff）

| 文件 | 行号 |
|---|---|
| `service/ButtonService.java` | 310, 315, 359, 447, 2279, 2300, 2685, 2719, 2721, 2758, 2885, 2888, 2952, 3116, 3157, 3160, 3173, 3174, 3263, 3269, 3278, 3279, 3340, 3356, 3359, 3447, 4026（27 行，全部 `//`/`*` 注释） |
| `service/PanelConfigService.java` | 515, 535, 560, 569 |
| `controller/QcProcInspController.java` | 25, 27, 103, 114, 125, 130 |
| `controller/QcFirstInspController.java` | 36, 50, 154, 208 |
| `controller/QcInspPlanController.java` | 47, 348, 351, 353, 357, 358 |
| `service/QcInspAutoService.java` | 37, 230 |
| `service/QcFirstInspReportSupport.java` | 29, 31 |
| `service/WoInspGate.java` | 18, 106, 159, 163 |
| `service/WoInspGateGuard.java` | 14 |
| `service/QueryService.java` | 58 |
| `service/ReportService.java` | 376, 634 |
| `controller/OqcReportController.java` | 29 |
| `controller/AuthController.java` | 391 |

> `ScheduleBoardService.java` 的 2 处命中（`:122`、`:1373`）是**数据键取值**（检验类型/排序），已列在 §2.1，不属于注释。

### 2.3 专项确认（任务第 7 项）

- `QcProcInspController.java` 全文（222 行）**没有导出接口**（`rg '导出|export|报表|pdf|xlsx|PDF'` 无命中）；建单接口 `/api/qc/procInsp/**` 无标题字面量。
- `PanelConfigService` 的 `metadata.panelName` 来自 `def.name()`（=`yj_panel.panel_name`），外文语言按 `yj_translation(scope='panel')` 取译名（`PanelConfigService.java:80` 档案分支 / `:467` 单据分支 + `:57-59` `panelDict()`）→ **改库即改后端所有下发文案**。
- `ButtonService` 审批消息的 `{panelName}` 取 `def.name()`（如 `:6425`）；`MessageService.panelNameOf` 同源 → DM 通知自动跟新名。
- 导出文件名：`ReportController` 的 `Content-Disposition` 与前端 `a[download]` 都基于面板名/模板名（见 §0），非硬编码。

---

## §3 报表模板（jrxml 及其注册表）

搜索：`rg -n '制程检验单|制程检验记录表|制程检验' backend/src/main/resources/reports frontend/src/i18n` 等。

| # | 文件:行号 | 现内容 | 判定 | 建议 |
|---|---|---|---|---|
| M34 | `backend/src/main/resources/reports/report-templates.properties:40` | `qc_proc_insp.name=制程检验记录表` | **必须改** | → `qc_proc_insp.name=出货检验记录表`（下拉开名字/兜底文件名） |
| M35 | `backend/src/main/resources/reports/qc_proc_insp.jrxml:142` | `<textFieldExpression><![CDATA["制程检验记录表"]]></textFieldExpression>` | **必须改** | → `CDATA["出货检验记录表"]`（PDF/XLSX 报表**大标题**） |
| — | `qc_proc_insp.jrxml:3`、`:6` | 文件头注释「制程检验记录表报表模板…」「好的当前制程检验形式错误了…」 | 可选 | 注释，改不改不影响输出 |
| — | `qc_first_insp.jrxml:5`、`:7` | 注释引用了「制程检验单已经存在实现」「参照制程检验单…」 | 可选 | 注释 |
| — | `qc_oqc.jrxml:112` | `<parameter name="制程检验单号" class="java.lang.Object" …/>` | **建议不改** | 参数名必须 = `yj_field.label`（`ReportService.headParams` 按标签下发），改它会连锁改字段/物理列（§8.2） |
| — | `report-templates.properties:30`、`:54` | 注释块（制程检验记录表版式说明/首件模板来历） | 可选 | 注释 |

**报表模板有两条运行源（ADR-0002）**：
1. **DB 优先**：`yj_report_template`（`template_code='qc_proc_insp'`，`name='制程检验记录表'`，`jrxml_text` 内标题 `CDATA["制程检验记录表"]`，见 §5.5）；
2. **classpath 兜底**：上面的 properties + jrxml。
   ⇒ 改版式/改标题必须**两处同源**：改仓库 `.jrxml` → 用生成器 `node tools/archive/_gen-qc-proc-insp-tpl-20261106.mjs`（读 `.jrxml` 写 `tools/migrate-qc-proc-insp-tpl-20261106.sql`）生成新迁移（新迁移文件另起名，**不要改动已执行的历史脚本字节**，否则 DbSync 会按内容哈希重跑）→ 两账套执行。

---

## §4 前端 i18n（biz 词条）与 tt() 回退

### 4.1 `tt()` 缺键回退行为（读 `frontend/src/i18n/index.js`）

- `index.js:103-116`：`tt(text)` — 语言为 `zh`/`zh-CN` 时**原样返回中文**；其它语言查当前 locale 的 `biz` 词典；
- 未命中 → `recordMiss(locale, text)`（`:114`）→ 去抖 500ms 批量调 `POST /api/locale/dict`（`main.js` 注册的 `ensureDict`，后端 `LocaleController.dict` → `TranslationService.translate`）→ **先查 `yj_translation` 的 `ui`/`field` scope，再阿里云机翻**，merge 进 i18n 后重渲（`:118-120` 注释）；
- 机翻不可用时**返回中文原文兜底**（`return text`，`:115`）。
- ⚠ 注意：后端 `TranslationService.translate` 只消费 `ui`、`field` 两个 scope（`TranslationService.java:108-109`）；`scope='report'` 的行**当前无消费点**（历史遗留，见 §5.2 O8）。
- 结论：新名（菜单/纸面/提示）**不加词条也不会报错**，外语下会机翻或回显中文；但按 AGENTS.md「新增 UI 文案必须交付多语言（至少 en.js）」应补齐。

### 4.2 现有含旧名的词条（file:line + key）

中文源即键；`biz` 段内键重复时**后定义生效**（en.js 有重复，见 M26 注）。

| # | 文件:行号 | 键（中文原文） | 现有译名 |
|---|---|---|---|
| M17 | `locales/th.js:66` / `:110` / `:111` / `:112` / `:115` | 生成制程检验单失败 / 未生成制程检验单 / 该工单行已有制程检验单 / 已生成制程检验单 / 「选择一条生产工单行…生成制程检验单草稿…」 | 泰语 |
| M18 | `locales/vi.js:66,110,111,112,115` | 同上 5 键 | 越南语 |
| M19 | `locales/ru.js:66,110,111,112,115` | 同上 | 俄语 |
| M20 | `locales/de.js:66,110,111,112,115` | 同上 | 德语 |
| M21 | `locales/fr.js:66,110,111,112,115` | 同上 | 法语 |
| M22 | `locales/es.js:66,110,111,112,115` | 同上 | 西语 |
| M23 | `locales/ko.js:66,110,111,112,115` | 同上 | 韩语 |
| M24 | `locales/zh-TW.js:114,159,160,161,164` | 同上（繁体译名内含「製程檢驗單」） | 繁中 |
| M25 | `locales/ja.js:66,110,111,112,115` | 同上 | 日语 |
| M26 | `locales/en.js:147,148,149,150,153` **另有重复定义** `:819,820,821,823` | 4 个消息键 + 长句；**重复定义以后者为准**（`819-823` 生效），两处都要改/去重 | 英文 |
| M27 | `locales/en.js:745` | 「方案按「适用单据」分套：首件检验单 / 制程检验单 / 组装成品检验单…」 | 英文（其它 9 语言**无此键**，靠机翻） |
| M28 | `locales/en.js:749` | `'制程检验单': 'In-process Inspection Sheet'` | 面板名/适用单据 label 的英文 |
| M29 | `locales/en.js:854` | `'制程检验记录表': 'In-Process Inspection Record'` | **纸面标题唯一静态词条**（其它 9 语言无，靠机翻） |
| M30 | `locales/en.js:675` | 「成型出首件检验单与制程检验单，组装出组装成品检验单…」 | 工单追溯说明（其它 9 语言无） |
| M31 | `locales/en.js:4405` | `'制程检验单(成型产出)': 'Process inspection (moulding output)'` | 首页流程看板节点名 |

> 词条清单执行建议：改完中文键后，**en.js 必须同步**；其余 9 包至少补 6 个高频键（4 消息 + 纸面标题 + 面板名/菜单名），否则外语界面靠机翻（`§4.1`）。

### 4.3 数据键词条（**建议不改**）

| 文件:行号 | 键 | 原因 |
|---|---|---|
| `locales/en.js:677` `th.js:2773` `vi.js:2773` `ru.js:2773` `de.js:2768` `fr.js:2768` `es.js:2768` `ko.js:2768` `ja.js:2976` `zh-TW.js:2898` | `'制程检验'` | 是「检验类别」取值（数据键）的显示层翻译，随语言变但不随面板名变（ADR-0001） |
| `locales/en.js:3284`、`zh-TW.js:1890` | `'制程检验单号'` | 字段数据键（物理列名），见 §8.2 |

---

## §5 数据库（两账套逐条证据，只读 SELECT）

执行方式（只读，两个库各跑一遍；SQL 文件在 `.tmp/insp-rename-20261108/r1~r5-*.sql`，输出在 `r1~r5-<DB>.out.txt`）：
```bash
cd D:/workspace/yinjia/tools
"C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe" -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 \
  -cp "lib/mssql-jdbc.jar" SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" \
  yinjia "Yinjia@2026" "D:/workspace/yinjia/.tmp/insp-rename-20261108/r1-rename-inventory.sql"
```
> **两账套结果逐字一致**（除 `yj_report_template.id` 差 1：正式 3/4、测试 4/5，属自增序差异）。以下若未标注，则两库相同。

### 5.1 `yj_panel`（面板名 = 页面标题/页签/导出名真源）→ **必须改**

| panel_code | panel_name | panel_name_en | config |
|---|---|---|---|
| `QC_PROC_INSP` | **制程检验单** | NULL | `{"inspGate":"block","inspGateLegacy":"pass"}`（**不含旧名**） |
| `QC_ASM_INSP`（对照） | 组装成品检验单 | NULL | `{"fixedItems":…}`（不含旧名） |

- 全表按 `panel_name LIKE '%制程检验%'` 只命中 `QC_PROC_INSP` 这一行；`config` 里无旧名（`r1-*.out.txt` 02 段）。
- **M36：`UPDATE dbo.yj_panel SET panel_name=N'出货检验单功能' WHERE panel_code=N'QC_PROC_INSP'`**（两账套；建议加 `AND panel_name=N'制程检验单'` 窄条件 + 行数守卫）。
- `panel_name_en` 为 NULL → 外文面板名走 `yj_translation(scope='panel')`（§5.2）。

### 5.2 `yj_translation`（含旧名共 6 行）

| # | scope | ref_key | locale | text | source | 判定 |
|---|---|---|---|---|---|---|
| M37 | **panel** | **制程检验单** | en | In-Process Inspection Sheet | manual | **必须改**：面板名译名。建议新增 `('panel','出货检验单功能','en','…','manual')`；旧行可保留（`yj_panel.panel_name` 改后旧键不再被查到） |
| — | field | 制程检验 | en | In-Process Inspection | manual | **建议不改**（检验类别数据键，§8.1） |
| O8 | field | 制程检验单 | en | In-Process Inspection Sheet | manual | **可选**：`yj_field` 里没有 `label='制程检验单'` 的字段 ⇒ 疑似孤儿词条，可删可留 |
| — | field | 制程检验单号 | en | In-Process Inspection No. | manual | **建议不改**（字段数据键，§8.2） |
| — | field | 制程检验单号 | zh-TW | 製程檢驗單號 | manual | **建议不改**（同上） |
| M38 | **report** | **制程检验记录表** | en | In-Process Inspection Record | manual | **必须改**：报表名译名。建议新增 `('report','出货检验记录表','en','In-Process/Shipment Inspection Record','manual')`（注意：当前代码不消费 report scope，但属报表模板名登记，随改名同步） |

> 共 6 行含旧名（`r1` 12 段计数：tr_any=6 / panel=1 / field=4 / report=1）；其它 scope（ui 等）**无**含旧名行。
> 另外：`yj_translation` 里已有「出货检验计划表 / 出货检验报告 / 出货检验项目控制计划」等**不同概念**的词条（`r2` 17 段），新名不会与之撞键，但语义相近（见 §8.5）。

### 5.3 `yj_field`（字段 label / 物理列名）→ **建议不改**（数据键，§8.2）

| # | panel_code | label | col_name | place | seq | hidden | visible | 说明 |
|---|---|---|---|---|---|---|---|---|
| — | `QC_BHG`（不合格报告(制程)） | 制程检验单号 | 制程检验单号 | header | 25 | 0 | 1 | 参照 `QC_PROC_INSP.单据编号`（`migrate-qc-bhg-bhc-link-20261101.sql` 建） |
| — | `QC_OQC_REPORT`（出厂检验报告） | 制程检验单号 | 制程检验单号 | header | 100 | 0 | 1 | 见 `migrate-oqc-report-20261030.sql` |
| — | `QC_PROC_INSP` 自身 | 无「制程」字段（`r2` 18 段：0 行） | — | — | — | — | — | 面板内字段不受影响 |

### 5.4 `yj_report_template`（报表模板行）→ **必须改**

| # | id（正式/测试） | template_code | panel_code | name | jrxml_text | enabled | update_at |
|---|---|---|---|---|---|---|---|
| M39 | 3 / 4 | `qc_proc_insp` | `QC_PROC_INSP` | **制程检验记录表** | 含 3 处「制程检验」；标题处为 `CDATA["制程检验记录表"]`（`r3` 21 段 ctx3 原文） | Y | 2026-11-06 15:35:2x |
| — | 4 / 5 | `qc_oqc` | `QC_OQC_REPORT` | 出厂检验报告 | 含 1 处「制程检验单号」（参数名，§8.2） | Y | 2026-11-04 |

- **改法**：改仓库 `qc_proc_insp.jrxml` → 生成新迁移 SQL（`_gen-qc-proc-insp-tpl-20261106.mjs` 同款，新文件名）→ `MERGE yj_report_template`（`name='出货检验记录表'`、`jrxml_text=新全文`、**`update_at=SYSDATETIME()` 必写**，否则编译缓存不失效）→ 两账套执行。
- 其它 jrxml 模板里出现旧名的只有 `qc_oqc` 的参数名（建议不改）。
- **`yj_button`、`yj_menu` 表不存在**（`r2` 13 段：`INFORMATION_SCHEMA` 只有 `yj_menu_node`、`permission` 等）→ 任务里「yj_button/yj_menu 是否存在」的答案是：**不存在**，按钮由 `ButtonService`/`yj_panel.config` 生成，无旧名数据行。

### 5.5 `yj_menu_node`（菜单设计器覆盖层，2026-10-23 新增）→ 当前**无需改**

| 检查 | 结果 |
|---|---|
| 表存在 | 是（列：`menu_code,parent_code,title,seq,hidden,is_new,icon,operator,updated_at,…`） |
| 行数 | **0 行**（`r3` 19 段 `COUNT(*)=0`，两账套相同） |
| `menu_code='qcProcInsp'` 或 `title LIKE '%制程检验%'` | 无行 |
| 结论 | 菜单名当前 = `menus.js` 基线；改 `menus.js:571` 即生效。若将来管理员在「菜单设计器」里改过名，`yj_menu_node.title` 会覆盖代码基线（本任务不改库，但验收前应确认仍为 0 行，否则界面不会变） |

### 5.6 物理列 / 表注明（非界面，**建议不改**）

| 类别 | 证据 | 判定 |
|---|---|---|
| 物理列名 | `qc_bhg.制程检验单号`、`qc_oqc_head.制程检验单号`（`r1` 10 段） | 建议不改 |
| 表/列 MS_Description | **10 行**含「制程检验单」（`r1` 11 段）：`bs_qc_plan.适用单据`、`qc_asm_insp_head.客户名称/检验时间/抽检总量`、`qc_bhg.制程检验单号`、`qc_proc_insp_detail`（表注明）、`qc_proc_insp_head`（表注明 + `工序`/`检验员`/`检验方案` 三条列注明） | 可选（运维注释，不影响界面） |
| 存量数据（**证明数据键不可轻改**） | 正式库 `qc_proc_insp_head` 445 行，其中 `检验类别='制程检验'` **432 行**（另 13 行 NULL）；测试库 43 行，其中 32 行「制程检验」（11 NULL）。`qc_proc_insp_detail` 正式 2535 / 测试 143 行。`qc_bhg.制程检验单号` 非空：0 行；`qc_oqc_head.制程检验单号` 非空：正式 0 / 测试 1（`r5` 26/27 段） | 建议不改（见 §8.1/§8.2） |

---

## §6 注释 / 测试里的旧名（一句话汇总 + 可选清单）

### 6.1 前端注释（**可选**，不显示给用户）

| # | 文件 | 行号（注释） |
|---|---|---|
| O1 | `frontend/src/business/menus.js` | 560, 568, 569, 570 |
| O2 | `frontend/src/core/views/PanelxList.vue` | 168, 443-448（注释块）, 2371, 2380, 2667, 2859, 2864, 2867, 4196, 4213, 4223, 4224, 4244, 4245, 4465, 5518, 5534, 5934, 7898, 8847, 8849-8852（注释块）, 8905, 8908, 8989, 8997, 9009, 9047, 9048, 9053, 10744, 10745, 10792 |
| O3 | `frontend/src/core/qc/QcProcInspSheet.vue` | 3, 6, 9, 22, 308, 428, 699, 703 |
| O4 | 其它前端 | `QcFirstInspSheet.vue:272`；`firstInspExport.js:6,148`；`engine.js:219`；`shipPlanDefaults.js:7`；`shipPlanDefaults.test.js:3,50`（测试名）；`qcInspector.js:4`；`qcInspector.js:2`；`QcInspPlanDialog.vue:8,28,145,361,383,438`；`docSheetConfigs.js:178-181`；各 locale 注释行（如 `en.js:786,817,824,825,845,850,852`、`ja.js:1914-1942`、`th.js:1898-1926` 等） |

### 6.2 后端注释：见 §2.2（可选）。

### 6.3 测试（**必须同步修改**，与源码同 commit）

| # | 文件:行号 | 内容 | 说明 |
|---|---|---|---|
| M32 | `frontend/src/core/qc/qcProcInspExport.test.js:42`、`:49` | `title: '制程检验记录表'` / `assert.equal(aoa[0][0], '制程检验记录表')` | 版式单测钉了标题；改 `qcProcInspExport.js:62`/组件标题后必须同改 |
| M33 | `frontend/src/core/qc/qcPlanApplicableDocs.test.js:25` | `docLabelsOf('QC_FIRST_INSP,QC_PROC_INSP'), '首件检验单、制程检验单'` | 改 `qcPlanApplicableDocs.js:10` label 后必须同改 |
| — | `frontend/src/business/menus.test.js:633-645` | 只钉 `qcProcess` 组的 panelCode 与数量（`QC_FIRST_INSP/QC_PROC_INSP/QC_ASM_INSP/QC_OQC_REPORT`），**未钉 title** | 改菜单 title **不需要**改此测试；但若「出货检验单功能」改变了**分组/顺序/入口数量**才需同步 |
| — | `shipPlanDefaults.test.js:3,50` | 测试名/注释里的「制程检验」，非文档名 | 不用改 |

> 现有测试中**没有**「全树不得含旧名」这类断言（`menus.test.js` 只有具体下架面板的断言），所以改名不会自动红；Lead 可参考 `menus.test.js:57` 的写法（`assert.ok(!JSON.stringify(menuTree).includes('内部委托测试申请单'))`）**补一条「菜单树不得再出现 制程检验单」**的回归断言（建议，非必须）。

### 6.4 可选清单 O1–O8（计数用，改不改不影响界面验收）

| # | 内容 | 位置 |
|---|---|---|
| O1 | `menus.js` 注释 | `menus.js:560, 568-570` |
| O2 | `PanelxList.vue` 注释 | 见 §6.1 行号列表 |
| O3 | `QcProcInspSheet.vue` 注释 | `:3,6,9,22,308,428,699,703` |
| O4 | 其它前端注释/测试名 | 见 §6.1 的「其它前端」 |
| O5 | 后端 Java 注释 | 见 §2.2（约 60 行） |
| O6 | jrxml/properties 注释 | `qc_proc_insp.jrxml:3,6`；`qc_first_insp.jrxml:5,7`；`report-templates.properties:30,54` |
| O7 | DB `MS_Description` 注释 | 10 行，见 §5.6 |
| O8 | DB 孤儿译名 `('field','制程检验单','en',…)` | `yj_translation` 1 行（`yj_field` 中无对应 label），见 §5.2 |

---

## §7 专项确认（任务第 7 项：纸面/导出/报表链路）

| 问题 | 结论 | 证据 |
|---|---|---|
| 纸面标题常量 | **无导出常量**，纸面标题写在模板里 | `QcProcInspSheet.vue:38` `{{ tt('制程检验记录表') }}` |
| 导出 Excel 的 sheet 名 | `tt('制程检验记录表').slice(0, 28)` | `QcProcInspSheet.vue:479` |
| 导出 Excel 的文件名 | `` `${tt('制程检验记录表')}-${name}.xlsx` `` | `QcProcInspSheet.vue:480`；`name` 兜底见 `:435` |
| 导出 Excel 的标题/副标题 | `title: tt('制程检验记录表')`；副标题=公司+单据编号+单据状态 | `QcProcInspSheet.vue:438-439`；版式在 `qcProcInspExport.js`（默认标题 `:62`） |
| 导出按钮链路 | 面板「文档输出 → 导出 Excel」→ `PanelxList.exportSheetExcel` 按面板码路由到 `exportProcInspExcel` | `PanelxList.vue:7898-7904`；`QcProcInspSheet.vue:483` `defineExpose({ exportProcInspExcel })` |
| 列表页导出（另一条路） | 走面板名拼文件名（自动跟新名），与纸面导出无关 | `PanelxList.vue:7659/9809/9833` |
| 后端 `QcProcInspController` 导出接口 | **没有**导出接口/无硬编码标题 | §2.3 |
| `/api/report/export?code=…` 的模板标题在哪 | ① 接口：`GET /api/report/export`（`ReportController.java:38` `@RequestMapping("/api/report")`，`:65-73` 参数 `code/panelCode/docNo/format`；**code = 模板编码 `qc_proc_insp`，不是面板码 `QC_PROC_INSP`**）；② 模板解析：DB `yj_report_template` 优先 → classpath properties 兜底（`ReportService.java:161-185`、`:332-338`）；③ 下拉显示名：`t.name()`（`ReportService.java:301`）＝ DB 行 `name`（§5.4）；④ PDF 大标题：jrxml staticText（`qc_proc_insp.jrxml:142`）＝ DB 行内 XML（§5.4） | `ReportController.java`、`ReportService.java`、`PanelxList.vue:1863/8258/8274-8279/8324` |

---

## §8 冲突点 / 风险（与「只改菜单名 + 纸面标题」口径的偏差）

### 8.1 「制程检验」是检验类别**存储值**（432+32 行），不是单据名
- 写入：`QcInspAutoService.java:254`、`QcProcInspController.java:181`；读取/显示：纸面抬头「检验类别」、列表页、`WorkOrderTraceDialog.vue:174`（`tt(row['检验类型'])`）、看板/追溯（`WorkOrderInspectionService.java:48/55`、`ScheduleBoardService.java:122/1373`）。
- **建议不改**（ADR-0001 数据键永不随显示名变；改需 UPDATE 432+32 行历史数据 + 改 6 处代码 + 排序逻辑，超出「只改菜单名+纸面标题」）。
- **但需用户知晓**：改完后纸面「出货检验记录表」的抬头仍会显示「检验类别：制程检验」——若用户认为这也是旧名，则要单独立项（数据迁移 + 代码同改，且看板/追溯同步）。

### 8.2 「制程检验单号」是**字段数据键+物理列名**（qc_bhg / qc_oqc_head）
- 证据：§5.3、§5.6；代码/配置 5 处：`yj_field` 2 行、`docSheetConfigs.js:185`、`qc_oqc.jrxml:112` 参数、`OqcReportService.java:160` SQL 列名；i18n `en.js:3284`/`zh-TW.js:1890`。
- **建议不改**：`label` 即 `dataName`、`ref_field` 指向 `QC_PROC_INSP.单据编号`，改 label 就要同时改物理列名（`ALTER TABLE … RENAME` 实为 sp_rename）、`yj_field.col_name`、参照 `ref_field`、以及任何按该键取数的代码；存量关联行正式库 0 行、测试库 1 行（负担小），但**属于结构变更**，与「只改显示名」不是一类改动。
- **替代方案（若用户坚持界面不露旧词）**：只把 `yj_field.label` 改为「出货检验单号」（`col_name`/物理列/参数名不动，`dataName` 若取 label 会连带变 → 需核对 `PanelConfigService.fieldSpec` 的 dataName 来源）。风险高，**不建议本轮做**。

### 8.3 新名口径需一次定清（三处不同称谓）
| 场景 | 建议新名 | 依据 |
|---|---|---|
| 菜单（左侧导航） | **出货检验单功能** | 用户原话 |
| 纸面标题 / 记录表 / 报表名 / Excel 标题 | **出货检验记录表** | 用户原话 |
| 单据级提示/看板节点/适用单据 label/面板名（`panel_name`） | **「出货检验单」还是「出货检验单功能」？待定** | `panel_name` 会同时出现在页签/浏览器标题/导出文件名/审批通知（如「出货检验单功能-单号.xlsx」）；建议 `panel_name=出货检验单功能`（与菜单一致、用户原话）或 `出货检验单`（更像单据名）。**这是本轮唯一必须让用户确认的口径**。 |

### 8.4 工具迁移链：**不要改历史脚本字节**
- `tools/*.sql` 根层共 **33 个文件 / 154 处**含旧名（如 `migrate-qc-proc-insp.sql:112` 建 `yj_panel.panel_name='制程检验单'`、`:201-207` 建 panel 译名；`migrate-qc-proc-insp-report-vertical-20261017.sql:24,152`、`migrate-qc-proc-insp-tpl-20261106.sql:26,167` 建模板行/标题）。
- `DbSync` 按**文件内容哈希**判断是否重跑（AGENTS.md 两账套纪律 §3）⇒ **改这些文件的字节会让它下次被重跑**（历史脚本重放撞 schema/重复灌数据）。
- 正确姿势：**新增一条改名迁移**（如 `tools/migrate-qc-proc-insp-rename-20261109.sql`：`yj_panel` UPDATE + `yj_translation` MERGE + `yj_report_template` MERGE），追加到 `tools/db-migrations.txt` **末尾**（当前末条= `migrate-wo-report-list-product-cols-20261108.sql`，格式见文件末尾 4~5 行注释+文件名），两账套 `DbSync` 跑「执行 0/失败 0」。
- 新装库全链重放时：旧脚本先生成旧名 → 新迁移最后覆盖成新名（只要新迁移排在末尾即可）。

### 8.5 与既有的「出货检验计划表」概念相近
- `yj_panel.RD_INSP_PLAN` = **出货检验计划表**（研发管理，现有面板，`r2` 17 段），是「检验项目来源」；另有 `yj_translation` 里「出货检验报告 / 出货检验项目控制计划」等词条。
- 新名「出货检验单功能 / 出货检验记录表」与之**不撞键**，但用户在菜单里会同时看到「出货检验计划表（研发管理）」和「出货检验单功能（制程品质）」，语义相近，**建议 Lead 在验收时向用户点明**（避免以后问「到底哪个是出货检验」）。

### 8.6 静态产物 / 服务生效路径（提醒，不是改代码触点）
- `backend/src/main/resources/static` 是**构建产物**（当前 git WIP 里另有会话正在重建，别碰），前端源码改完后必须 `npm run build` → 同步 static → 重新打包/换 jar（8090）；否则 8090 看到的还是旧前端（旧名）。
- 5173 vite 源码即时生效；验收优先 5173（AGENTS.md 界面验证口径）。
- 报表模板走 DB 优先 → 库内行改完**立即生效**（编译缓存按正文哈希失效），无需重启；但仓库 `.jrxml`/properties 是部署源，必须同源。

### 8.7 其它非界面残留（可不改）
- `docs/` 文档与 `tools/archive/` 里有大量旧名（如本盘查背景、历史验收记录），非界面，**本任务不改**；`tools/db-migrations.txt` 34 处说明性注释同理。
- `yj_usage_log.panel_name` 历史行保留旧名（审计事实，不改）；新操作会写新名。
- `backend/src/main/resources/static/**` 里的旧名是构建产物（本次不碰，重建后消失）。

### 8.8 建议不改清单 N1–N7（计数用）

| # | 内容 | 证据/原因 |
|---|---|---|
| N1 | 「检验类别」取值 `制程检验`（数据键 + 存量 432/32 行 + 6 处代码读写 + 10 语言译名） | §8.1、§5.6 |
| N2 | 「制程检验单号」字段（`yj_field` 2 行、物理列 2 个、`qc_oqc.jrxml` 参数、`OqcReportService` SQL、`docSheetConfigs.js:185`、i18n 2 条） | §8.2、§5.3 |
| N3 | 面板码 `QC_PROC_INSP` / 表名 `qc_proc_insp_head/_detail` / 接口路径 `/api/qc/procInsp/**` / 单据前缀 `ZC` | 稳定键：权限、路由、单据编号、历史数据全按它走；改名会牵连权限/号池/追溯（本任务只改显示名） |
| N4 | `tools/*.sql` 历史迁移 33 文件 / 154 处 | 改字节会触发 DbSync 按内容哈希重跑，见 §8.4 |
| N5 | `docs/` 文档（设计文档/数据库表清单/开发记录等） | 非界面；不在本任务范围 |
| N6 | `backend/src/main/resources/static/**`（含旧名的构建产物） | 构建产物，重新 build 后自动消失，不手改 |
| N7 | `yj_usage_log` 等历史行数据里的旧 `panel_name` | 审计事实，保留旧值；新操作自动写新名 |

---

## §9 实施顺序建议（供 Lead，不在本任务范围）

1. **先定口径**（§8.3）：菜单名=出货检验单功能；纸面/报表=出货检验记录表；`panel_name`/toast/看板/适用单据 = ?（建议「出货检验单」或「出货检验单功能」二选一并让用户点头）。
2. 前端代码：M1–M16（+ M32/M33 测试同 commit）。
3. i18n：M17–M31（en 必做；建议 10 包同步补 6 个高频键，按 AGENTS.md 交付）。
4. 资源：M34/M35（`properties` + `qc_proc_insp.jrxml`）；用现有生成器 `node tools/archive/_gen-qc-proc-insp-tpl-20261106.mjs` 的同款方式（复制成新名脚本）生成新迁移 SQL。
5. DB 新迁移：M36–M39（`yj_panel` + `yj_translation`×2 + `yj_report_template`；`update_at=SYSDATETIME()`；幂等 + 行数守卫 + 末尾自检；两账套执行、先正式后测试）。
6. 登记 `tools/db-migrations.txt` 末尾 + `git status` 检查不夹带本机 WIP。
7. 验收：5173 切 en/ja 走查菜单、页签、纸面标题、Excel 导出（sheet 名/文件名/标题）、打印预览、报表下拉+PDF 标题、「选生产工单」toast、「检验方案维护」提示、首页流程看板、工单追溯说明、参照弹窗（QC_BHG 选 QC_PROC_INSP 后显示的面板名）；再跑相关单测（`node --test frontend/src/core/qc/qcProcInspExport.test.js` 等，按仓库习惯）。

---

## §10 并发实施状态快照（2026-11-09 00:13–00:20 观察；**不是本盘查员所做**）

> ⚠ 盘查期间工作区出现另一批并发改动（`git status` 显示 frontend/src 多个文件 M、新增 `tools/migrate-qc-proc-insp-rename-20261109.sql`、
> `tools/migrate-qc-proc-insp-tpl-20261109.sql`、`tools/archive/_gen-qc-proc-insp-tpl-20261109.mjs`，且两账套库内名字**已被改成新名**）。
> 本盘查全程只写 `.tmp/`，未参与这些改动。下面按「§1–§5 的 M 编号」核对**已完成 / 仍待改**，供 Lead 汇总时防漏（快照会随并发继续变化，请以最新工作区为准）。

### 10.1 已完成（快照时的证据）

| M | 内容 | 快照证据 |
|---|---|---|
| M1 | 菜单标题 | `menus.js:573` `title: '出货检验单功能'`（`:568-569` 注释同步；`menus.test.js` 已随之改） |
| M2–M6 | 纸面标题 + Excel 标题/sheet/文件名/兜底 | `QcProcInspSheet.vue:38/435/438/479/480` 全部为「出货检验记录表」 |
| M7 | 导出纯函数默认标题 | `qcProcInspExport.js:62` 默认 `'出货检验记录表'`（`:4/:55` 注释同步） |
| M32 | 导出单测 | `qcProcInspExport.test.js:42/49` 已改 |
| M35 | 仓库 jrxml 标题 | `qc_proc_insp.jrxml:144` `CDATA["出货检验记录表"]`（行号 142→144） |
| M36 | `yj_panel.panel_name` | 两账套实测：`QC_PROC_INSP = 出货检验单功能` / `panel_name_en = Outgoing Inspection Sheet (Functional)`（`r6-*.out.txt` S1） |
| M37 | `yj_translation(panel)` | 两账套：`('panel','出货检验单功能','en','Outgoing Inspection Sheet (Functional)')`（S2；旧 key 行已不在） |
| M38 | `yj_translation(report)` | 两账套：`('report','出货检验记录表','en','Outgoing Inspection Record')`（S2） |
| M39 | `yj_report_template` | 两账套：`name=出货检验记录表`、XML 内新标题 3 处、`update_at` 非空（`r6` S3 / `r7` S5） |
| — | 改名迁移脚本 | `tools/migrate-qc-proc-insp-rename-20261109.sql`（yj_panel + yj_menu_node 覆盖行 + yj_translation）与 `tools/migrate-qc-proc-insp-tpl-20261109.sql`，已登记 `tools/db-migrations.txt` 末尾 |
| — | `yj_menu_node` | 快照时仍 0 行（`r6` S4），脚本已兜住「服务器若有覆盖行」 |

### 10.2 仍待改（快照时仍是旧名；**若已有其它人接手请以最新为准**）

| M | 文件:行 | 快照内容 |
|---|---|---|
| M8–M10 | `PanelxList.vue:8858/8861/8862` | 仍 `tt('未生成制程检验单')` 等 3 键（文件未被并发改动） |
| M11–M12 | `QcProcInspWoPicker.vue:34/237` | 仍旧名（文件未被改） |
| M13 | `QcInspPlanDialog.vue:42` | 仍旧名（该文件本次并发改动是「不合格应对措施列移除」，与本改名无关） |
| M14 | `qcPlanApplicableDocs.js:10` | 仍 `label: '制程检验单'`（文件未改） |
| M15 | `flowSpec.js:151` | 仍 `name: '制程检验单(成型产出)'`（文件未改） |
| M16 | `WorkOrderTraceDialog.vue:191` | 仍旧名（文件未改） |
| M17–M26 | `i18n/locales/*.js`（10 包） | **仍无新词条**：`rg '出货检验单功能|出货检验记录表' frontend/src/i18n/locales` 0 命中；旧 4 个消息键 + 长句仍在（各包行号见 §4.2）。⚠ 当前 `tt('出货检验记录表')`/`tt('出货检验单功能')` 在 en/ja… 下**只能走机翻或回显中文**（`§4.1`） |
| M27–M31 | `en.js:745/749/854/675/4405` | 仍旧 key（新 key 未加） |
| M33 | `qcPlanApplicableDocs.test.js:25` | 仍断言旧名（依赖 M14） |
| M34 | `report-templates.properties:40` | 仍 `qc_proc_insp.name=制程检验记录表`（文件未改）→ DB 优先所以运行期 OK，但**新装库/库行被删时会回落旧名**，必须同源 |

### 10.3 并发改动带来的两个注意点

1. **行号漂移**：`menus.js`(+2 行)、`QcProcInspSheet.vue`、`qc_proc_insp.jrxml`(+2) 等已改文件的行号与 §1/§3 基线差 2~3 行；核对时用内容搜索而不是只认行号。
2. **改前请确认提交范围**：当前工作区同时混有其它任务 WIP（`backend/src/main/resources/static` 删除、`WorkOrderProgressController`、`router/index.js`/`WorkOrderList.vue`/各 locale 的 +62 行等）。按 AGENTS.md「单任务单提交」，提交改名时必须只挑本任务文件，别把 WIP 夹带进去。

---

## 附录 A：证据文件（本次只读产物，均在 `.tmp/insp-rename-20261108/`）

| 文件 | 内容 |
|---|---|
| `r1-rename-inventory.sql` / `r1-HSDZ_MES.out.txt` / `r1-HSDZ_MES_TEST.out.txt` | 12 段：yj_panel/yj_translation 各 scope/yj_field/yj_report_template/表存在性/物理列/MS_Description/计数（**基线=旧名**） |
| `r2-rename-inventory.sql` / `r2-*.out.txt` | 13~18 段：按钮菜单类表、`yj_menu_node` 列与行、模板 XML 标题计数、qc_oqc 参数、新名占用、QC_PROC_INSP 字段 |
| `r3-rename-inventory.sql` / `r3-*.out.txt` | 19~22 段：`yj_menu_node` 行数（0）、模板 XML 标题原文（基线：`CDATA["制程检验记录表"]`） |
| `r4-rename-inventory.sql` / `r4-*.out.txt` | 23~25 段：dict_sql 无旧名、检验类别字段、无其它面板 config 引用 |
| `r5-rename-inventory.sql` / `r5-*.out.txt` | 26~27 段：检验类别存量数据（432/32 行）、单据行数、关联列存量 |
| `r6-state-snapshot.sql` / `r6-*.out.txt` | **并发实施后快照**：yj_panel 新名/译名/模板名与标题确认、`yj_menu_node` 0 行 |
| `r7-tpl-state.sql` / `r7-*.out.txt` | 模板 XML 现状：新标题 3 处、残留 2 处「制程检验」均为注释；`field` 孤儿行仍在 |

## 附录 B：复跑命令

```bash
# 前端/后端/资源全量搜索（排除项见文件头）
rg -n '制程检验单|制程检验记录表|制程检验' frontend/src backend/src/main/java backend/src/main/resources/reports
rg -n '制程检验' frontend/src/i18n/locales
# 两账套只读 DB（把 databaseName 换 HSDZ_MES_TEST 再跑一遍）
cd tools && "C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe" -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 \
  -cp "lib/mssql-jdbc.jar" SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" \
  yinjia "Yinjia@2026" "D:/workspace/yinjia/.tmp/insp-rename-20261108/r1-rename-inventory.sql"
```
