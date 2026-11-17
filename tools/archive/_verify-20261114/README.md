# 独立验收报告 · 2026-11-14（task-5）

> 验收者：verifier（独立验收，不写实现）。任务单：`tools/archive/_verify-20261114/TASK.md`；共享任务板 `task-5`。
> 验收对象：① 首件检验单（QC_FIRST_INSP）纸面黄格改造（前端 + 服务端报表）；② 巡线检验（QC_LINE_PATROL）新面板。
> 契约：`docs/design/首件检验单-可填范围.md`（第十轮）、`docs/design/成型车间巡线记录表-首版.md`。

## 0. 结论速览

| 组 | 项数 | PASS | FAIL | N/A | 备注 |
|---|---|---|---|---|---|
| A 首件检验单 | A1~A4 | **4** | 0 | 0 | A4 在 Lead 换包后完成（8090 新 jar + 服务端 Jasper PDF 取证） |
| B 巡线检验 | B1~B6 | **6** | 0 | 0 | 含只读态、打印预览新窗口、英文界面（Lead 额外项） |
| C 静态/构建/DB | C1~C5 | **5** | 0 | 0 | 两账套 |
| **第十一轮补验**（2026-11-15 · 挤压强度上移 5#/6#） | 1~3 | **3** | 0 | 0 | 新包 SHA256 `6FA1CF34…`；5173 DOM / 真落库 / 8090 服务端 Jasper PDF 全 PASS，见 §8 |
| **合计** | **18** | **18** | **0** | **0** | 1 个 P2 缺陷（非验收条款、不阻塞）见 §4 |

环境指纹（取证时）：
- 5173 = vite 源码版（PID 33072，`✓ built in 27.40s` 的产物亦为当前源码）；8090 = 新 jar（PID **1848**，JDK25 `-jar target\yinjia-mes-backend-0.1.0.jar`）。
- `backend/target/app.jar` SHA256 = `4650edc22358000468bd45dfeb6705030200fc68fd6775832cde0c5d01d64b4a`（= Lead 公布的 `4650EDC2…`）；jar 内 static 首页 chunk = `index-BDI-BmBU.js`（8090 实测加载同一 chunk）。
- DB：127.0.0.1:1433 `HSDZ_MES`（正式）/ `HSDZ_MES_TEST`（测试）；登录工厂 `YJ` / `YJ_TEST`。
- 工具：前端 `node --test`（Node v22.20.0）；后端 JDK **25.0.4.1**（`C:/Users/vigna/.jdks/ms-25.0.4`）；DB 用 `tools/lib/mssql-jdbc.jar` + 本目录 `Q.java`/`SqlRunner`。
- ego-browser：taskSpace `verify-20261114`；脚本源 `C:/Users/vigna/ego/verify-20261114/round-01..35.mjs`（已全部拷入本目录）。
- **第十一轮补验（2026-11-15 00:05 换包）**：8090 新 jar SHA256 = `6fa1cf346c589384c559bbf5cc8c99c833b42d884a5eec930315786eaad8453a`（= Lead 公布的 `6FA1CF34…`，`app.jar` 与 `yinjia-mes-backend-0.1.0.jar` 同哈希）；static 入口 chunk = `index-Dc3ViIde.js`；本轮 ego 任务空间 `verify-20261114-r11`（上一轮空间已按规范关闭），脚本 `round-40..46.mjs`。

---

## 1. A. 首件检验单（QC_FIRST_INSP）纸面黄格

### A1 — 5173 新建草稿 DOM 取证：**PASS**
证据：`a1-evidence.json`、`round-01.mjs`、`round-02.mjs`、`round-33.mjs`、`round-02-first-insp-full.png`、`round-33-checkbox.png`

| 判据 | 期望 | 实测 |
|---|---|---|
| `.sample-row td.gz-y` 数量 | 20 | **20** |
| 可填格计算背景色 | `rgb(255,243,202)`（#FFF3CA） | **唯一值 `rgb(255, 243, 202)`** |
| 样品行 `/` 只读格 | 60 | **60**（10 列×8 行 80 格 − 20 黄格） |
| 样品行数 / 列数 | 8 / 10 | **8 / 10**（列序 = 表观、脱粉、外径、内径、长度、重量、跌落、挤压、浊度、压降） |
| 标准行 `td.std-check` | 2 | **2** |
| 标准行灰底 | `rgb(217,217,217)`（#D9D9D9） | **`rgb(217, 217, 217)`** |
| 标准行这两格有无输入控件 | 无 | **`input,textarea` = 0** |
| 逐列可填行（DOM 判定：有输入框 / 有勾选框） | 见下表 | **逐列一致** |
| 1#/2# 表观两列 | 勾选式可点 | 12 个 `.fi-box`（2 列×2 行×3 选项）；点第 1 个：`□ → ☑`（`.fi-box.on` 1 个） |
| 3#..8# 表观列 | 显示 `/`、无输入控件 | 无 input、无 `.fi-box`，文本 `/` |
| 不可填格 hover title | 该列自己那两行 | `1#跌落 = 「…（5#、6#）」`、`5#外径 = 「…（3#、4#）」`、`8#表观 = 「…（1#、2#）」` |

DOM 实测逐列可填行：表观 `1/2`、脱粉 `1/2`、外径 `3/4`、内径 `3/4`、长度 `3/4`、重量 `3/4`、跌落 `5/6`、挤压 `7/8`、浊度 `7/8`、压降 `7/8` —— 与契约 §一 逐格一致；页面内合计 **可填 20 / `/` 60**。

> 补充：同一矩阵在 **8090 打包版**复核一致（`round-17`：gzY=20、`/`=60、std-check=2、颜色同值，且三个样本值从库里读回正确）——即前端产物已进 jar/static 新包。

### A2 — 黄格真落库（填值 → 保存 → 查库 → 刷新仍在）：**PASS**
证据：`_a2-db-evidence.txt`（SQL + 输出实录）、`a2-save-wire3.json`（保存请求/响应）、`round-03-filled.png`、`round-10-reopened.png`、`round-17` 输出

- 保存动作捕获：`POST /api/px/callButton → 200`，响应 `{"单据状态":"草稿","编号":"SJ-2026-11-0011"}`，UI 提示「「保存」成功」。
- 库（HSDZ_MES）`qc_first_insp_head` = `SJ-2026-11-0011`（单据日期 2026-11-14、admin、23:01:37）；`qc_first_insp_detail` **90 行**。
- 90 行里 `实测数值` 非空的**恰好 3 格**，且正是：(outer,3#)=`12.3`、(drop,5#)=`50cm`、(compress,7#)=`31` ⇒ **其余不可填格没有新值**。
- 刷新页面重开该单：三值仍在（`round-10` 输出 v3outer=12.3 / v5drop=50cm / v7press=31）；8090 打包版重新查库渲染同单也一致。
- 造数已清理（见 §5）。

### A3 — 界面导出（PDF / Excel）：**PASS**
证据：`a3-export.pdf`、`a3-export.xlsx`、`a3-pdf-page.png`、`_a3-analyze.log`、`_a3-pdf-image.log`、`round-11-export-menu.png`

- 侧栏「导出」弹窗三项：打印预览 / 导出 PDF / 导出 Excel（.xlsx），文案正确。
- **导出 PDF**：下载成功（`首件检验单-SJ-2026-11-0007.pdf`，277,093 B，1 页 A4 竖 595×842，内嵌 1960×1950 页图）；解出页图（`a3-pdf-page.png`）：**非空白**（黄格像素占比 10.05%、白 63.6%、字/线 1.25%），纸面标题/两级表头/标准行/1#..8#/黄格都在。
- **导出 Excel**：下载成功（23,714 B，`A1:K26`）；表头是纸面两级表头，**不存在「行类型/检验列」长表头**；样品行 `/` = **60**（标准行另有 10 个 `/`，属空标准格的既有写法）；`12.3 / 50cm / 31` 三个值都在。
- ⚠ 客户端 PDF/Excel 的 PDF 右侧列裁切问题见 §4（P2，不违反本条判据）。

### A4 — 服务端报表 PDF（Lead 换包后）：**PASS**
证据：`a4-server-report.pdf`（95,211 B）、`_a4-server-text.txt`、`_a4-analyze.log`、`round-20-a4-server-report.png`、`round-19.mjs`、`round-17`（8090 DOM）

- 8090 = 新 jar（SHA256 与 Lead 公布一致、首页 chunk `index-BDI-BmBU.js`），打开已保存单 `SJ-2026-11-0011` → 走 `/api/report/export?code=qc_first_insp&panelCode=QC_FIRST_INSP&format=pdf` 取服务端 Jasper 报表：
  - **1 页**，`/MediaBox [0 0 842 595]`（A4 横向），无内嵌图片（矢量文本 PDF）；
  - 内容流取色：黄底 `1 0.95294 0.79216 rg`（= #FFF3CA）**恰好 20 次**；灰底 `0.85098 0.85098 0.85098 rg`（= #D9D9D9）**恰好 2 次**；
  - 文本层（openpdf 抽取，1,525 字）：公司抬头、标题「炭棒成型车间首件检验记录表」、两级表头（表观及脱粉/尺寸及重量/强度/浊度及压降 → 10 列）、**标准行**、**1#..8#**、三值 `3# … 12.3`、`5# … 50cm`、`7# … 31`（列位对得上：外径第 3 列、跌落第 7 列、挤压第 8 列）、相关要求 6 条、表尾检验结果/检验人/审核人/批准、页码；
  - `round-20-a4-server-report.png`：浏览器 PDF 阅读器截图，人眼可见黄格位置正确（1#/2# 表观脱粉、3#/4# 尺寸、5#/6# 跌落、7#/8# 挤压+浊度+压降）。
- 备注：UI 的「导出报表→导出 PDF」对这两张纸面单已按 2026-10-21 既有口径走**客户端纸张渲染**（弹窗文案「与打印同一份渲染」）；服务端 Jasper 版式经上面 API 取证，两者不矛盾（详见 §4 说明）。

---

## 2. B. 巡线检验（QC_LINE_PATROL）

### B1 — 菜单存在、点击可进：**PASS**
证据：`b1-click.json`、`round-25-menu-card.png`、`round-25-patrol-entered.png`

- 左导航「品质管理」(Quality Management) 悬停卡片：列「来料品质 / **制程品质** / 质量单据」；制程品质组顺序 = 首件检验单、出货检验单功能、出货检验表观、**出厂检验报告**、**巡线检验**（在出厂检验报告之后 ✓）。
- 点「巡线检验」→ 路由 `#/panelx/list/QC_LINE_PATROL`，**未被踢回登录页**，侧栏按钮齐（新增/保存/保存为草稿/打印/导出报表/导出…）。
- 8090 打包版同一入口复核通过（`round-31`：hasPatrol=true、idx=9、prev=出厂检验报告；点击进页面成功）。

### B2 — 纸面版式（12 列 × 每块 4 子行 × 默认 3 块）：**PASS**
证据：`b1b2-paper.json`、`round-21-patrol-5173.png`、`round-32-8090-patrol.png`

| 判据 | 期望 | 实测 |
|---|---|---|
| 标题 | 成型车间巡线记录表 | **成型车间巡线记录表** |
| 左「日期」/ 右「审核人」 | 有 | 「日期：」+ 日期控件（2026-11-14）/「审核人：」（只读文本） |
| 表头 12 列（顺序照纸样） | 巡线时间/车间/产品信息确认（重点产品标注★）/炭棒长度范围mm/内径检查mm/重量范围g/两液密度（伊玛印品耐水煮要求测试）/表面状态/跌落强度/抗压强度/结果判定/巡线人员 | **12 列逐字一致**（可编辑时多一列「增删」，no-print） |
| 每块子行 | 4 行：编号①+三组标准值 / 型号①+三组实测 / 编号②+三组标准值 / 型号②+三组实测 | 第 1 块 4 行文本依次 = 编号/标准值×3、型号/实测×3、编号/标准值×3、型号/实测×3 ✓ |
| 块级列 rowspan | 4 | 8 个块级列 × 3 块 = **24 个 `rowspan=4`**（+3 个行操作列 = 27）✓ |
| 空草稿默认块数 | 3 | **3 块 / 12 个 `.lp-row` / 72 个可填框** |

### B3 — 可增删块：**PASS**
证据：`b3b4-save.json`、`round-26-patrol-saved.png`
- 点第 1 块「＋」：块数 3 → **4**（行 12 → 16，＋/× 按钮各 4）。
- 点最后一块「×」：块数 4 → **3**（行 16 → 12，按钮各 3）。

### B4 — 填满一块 → 真落库（head/detail）→ 刷新仍在：**PASS**
证据：`_b4-db-evidence.txt`、`b3b4-save.json`、`b4b5.json`、`round-26-patrol-saved.png`、`round-27-patrol-reopened.png`（DB：HSDZ_MES_TEST）
- 填满第 1 块 24 格（8 个块级格 + 产品①②各 8 格）→ 「保存」成功，单号 **XJ-2026-11-0003**。
- `qc_line_patrol_head`：单据编号 `XJ-2026-11-0003`、**单据日期 2026-11-14**、审核人 null（本期只读）、admin、23:18:12。
- `qc_line_patrol_detail`：**3 行、行号 1..3**；第 1 行逐字段与填写一致（巡线时间 08:30、车间 成型一车间、编号1 A001、型号1 T410-63*40*193、长度标准1 193、长度实测1 193.0、内径…、编号2 A002、长度实测2 192.5、重量实测2 62.7、两液密度 1.02、表面状态/跌落/抗压/结果判定=合格、巡线人员 张工）；第 2/3 行为空块（行号存在，值为 null）。
- 刷新页面重开 XJ-2026-11-0003：所有值仍在、日期 2026-11-14、仍 3 块（`b4b5.json` REOPENED）。
- 造数已清理（见 §5）。

### B5 — 打印/导出 PDF（非空白纸面）+ 打印预览新窗口：**PASS**
证据：`b5-patrol.pdf`、`b5-patrol-page.png`、`_b5-pdf-image.log`、`round-27` 输出、`round-29-print-preview.png`、`round-28`/`round-29` 脚本
- 「导出」→「导出 PDF」：下载 `成型车间巡线记录表-XJ-2026-11-0003.pdf`（161,010 B，1 页 A4 竖），解出页图 **非空白**（暗像素 2.03%、非白 16.44%），纸面标题/日期/审核人/12 列表格/3 块 4 子行/已填值全部渲染（`.lp-sheet` 已进截图/PDF 白名单）。
- 「导出报表」→「打印预览」（Lead 额外项）：用真实鼠标点击后**新窗口/新标签页**打开 `blob:http://localhost:5173/<uuid>` 的 PDF（`round-29`：p2 页签，PDF 阅读器 1/1 页，见截图）——新窗口 PDF 通道成立。
- ⚠ 右侧列裁切问题见 §4（P2；本条判据「非空白纸面 PDF / 进白名单」仍成立）。

### B6 — 英文界面不出现裸中文：**PASS**
证据：`b6-en.json`、`round-30-menu-en.png`、`round-30-patrol-en.png`
- `mes_locale=en` 后：菜单组 `Quality Management` → 卡片分组 `Process Quality`，条目 **`Line Patrol Inspection`**（英文，位置仍在 Factory Inspection Report 之后）。
- 纸面：标题 **`Forming Workshop Line Patrol Record`**；12 列表头全部英文（Patrol Time / Workshop / Product Information Confirmation (mark key products with ★) / … / Patrol Inspector）；「日期/审核人」标签 = `Date：`、`Approved by：`。
- 模板内**标题/表头/标签/侧栏按钮**均无 CJK（勾选 `bad` 全空）；用户数据（成型一车间、合格、张工等）属业务事实，按 ADR-0001 不翻译（正确）。
- 语言包静态核对：`frontend/src/i18n/locales/*.js` 中除 zh-CN（源语言）外 **10 个语言包**都含「巡线检验」「成型车间巡线记录表」词条。

### B0-extra — 只读态 / 左栏切单（Lead 额外项）：**PASS**
证据：`b-readonly.json`、`round-35-patrol-readonly.png`、`_readonly-set.sql`、`_readonly-restore.sql`（见 `_cleanup-evidence.txt`）
- 临时把测试单 `XJ-2026-11-0001` 的 `yj_doc_status.shr` 置 `admin` → 列表状态列显「已审核」，打开后纸面 `.lp-sheet` **无 `is-editing`、输入框 0 个**，全部按文本显示既有值（巡线时间 09:15、编号 CR-T01、长度实测 112.05、巡线人员 测试员），块级列 rowspan=4 仍正确（只读态无操作列 ⇒ 24 个）。**看完立即还原 `shr=NULL`（已核对 RESTORED）。**
- 左栏「单据选择」点行可切换单据（本轮多次用 XJ-2026-11-0003/0001 互换打开，状态标签「草稿/已审核」随行刷新）。

### 8090 打包版巡线复核（Lead 额外项）：**PASS**
证据：`b8090-patrol2.json`、`round-32-8090-patrol.png`、`round-31-8090-patrol.png`
- 新 static（`index-BDI-BmBU.js`）→ 菜单入口同 5173；测试库打开 `XJ-2026-11-0003`：标题、**12 列表头**、**3 块 / 12 子行 / 24 个 rowspan=4**、已填值（08:30 / A001 / 193.0 / 张工）、日期 2026-11-14 全部渲染正确。正式库无巡线单据（未在正式库造数）。

---

## 3. C. 静态 / 构建 / DB 复核

### C1 — 前端构建 + 单测：**PASS**
证据：`_build-frontend.log`、`_c1-node-test.log`
- `cd frontend && npm run build`：`✓ built in 27.40s`，exit 0（仅有 vite 既有的 chunk 体积提示，无错误）。
- `node --test src/core/qc/firstInspCols.test.js src/core/qc/firstInspExport.test.js src/business/menus.test.js`：**tests 65 / pass 65 / fail 0**（exit 0；含 menus 对「制程品质组现役五张单」的断言）。

### C2 — 后端编译（JDK 25）：**PASS**
证据：`_build-backend.log`
- `JAVA_HOME=C:/Users/vigna/.jdks/ms-25.0.4 mvn -q -DskipTests compile`：先打印 `openjdk version "25.0.4.1"`，**EXIT=0**，日志 0 个 ERROR（只有 JDK 自带的 sun.misc.Unsafe 过时 WARNING）。

### C3 — 两账套 DB（表/面板/字段/授权/译名 + DbSync）：**PASS**
证据：`_c3-check.sql`、`_c3-HSDZ_MES.log`、`_c3-HSDZ_MES_TEST.log`

| 判据 | 正式库 HSDZ_MES | 测试库 HSDZ_MES_TEST |
|---|---|---|
| `qc_line_patrol_head`/`_detail` | 2 张都在 | 2 张都在 |
| `yj_panel`（QC_LINE_PATROL） | 1 行：成型车间巡线记录表/品质管理/doc/line=qc_line_patrol_detail/head=qc_line_patrol_head/group=单据编号/pk=id/code=单据编号/prefix=XJ/date=单据日期/page_size=20/detail_key=items/module_group=品质管理 | 同 |
| `yj_field` | **30**（明细 25 含 hidden `行号` + 头 `query,header` 5） | 同 |
| `yj_role_panel` 授权 | **13** 行（角色 1042 带 print/audit 等全部） | **7** 行 |
| 面板名/字段名 en 译名缺失 | **0**（30 个字段标签全覆盖 en；面板名 en = `Forming Workshop Line Patrol Record`） | **0** |
| 表/列中文注明（MS_Description） | 表 2 / 列 34 | 表 2 / 列 34 |
| `yj_schema_log` 迁移登记 | 1 条 | 1 条 |
| `DbSync sync` | **执行 0、跳过 749、失败 0** | **执行 0、跳过 749、失败 0** |

### C4 — git 工作区：**PASS（有部署同步，符合 TASK 例外）**
证据：`_c4-git-status.txt`
- 非 static 变更 = 本两任务的源码/文档/迁移/i18n 与本次验收目录（`tools/archive/_verify-20261114/`），**无预期外文件**；未出现 `git add/commit`。
- `backend/src/main/resources/static`：**76 个旧 chunk 删除 + 83 个新 chunk 未跟踪**（新首页 `index-BDI-BmBU.js` 于 23:09 同步）——即 Lead 的部署同步产物，符合 TASK「除非 Lead 做了部署同步」的例外；建议 Lead 收尾按习惯单独 `chore: 前端静态产物同步(...)` 提交。
- 工作区干净度：`git status` 里没有 backend 旧构建产物、没有 `.bak`、没有敏感文件。

### C5 — 三处矩阵与契约逐格一致（不靠肉眼）：**PASS**
证据：`_c5-matrix.mjs`/`_c5-matrix.log`（验收者独立脚本）、`_c5-impl-matrix.log`（实现方脚本复跑）、`_c1-node-test.log`、`_a4-server-text.txt`
- 验收者独立脚本（期望矩阵手工抄自契约 §一，不 import 实现常量）：frontend `sampleRowsOf/isFillableCell/isCheckColumn` 逐列可填行、80 格 20/60、标准行只读列 = 表观/脱粉、Excel 导出（每格塞不同值验证不吃历史值）→ **全 PASS**（`[PASS] frontend 列模型 + Excel 导出与契约 §一 逐格一致(可填 20 / 斜杠 60)`）。
- 实现方校验脚本复跑：`verify-matrix.mjs` → **EXIT 0 / PASS**（20 可填 / 60 `/`）。
- 服务端 `QcFirstInspReportSupport`：经 A4 实跑 jar 的服务端 PDF 取证 —— 黄 20 次 / 灰 2 次、文本层里 12.3/50cm/31 分别落在 3# 外径 / 5# 跌落 / 7# 挤压 列位（`_a4-server-text.txt`），与契约矩阵一致。

---

## 4. 发现的问题 / 观察（非验收条款 FAIL，不阻塞验收）

### P2-1 客户端 PDF（导出 PDF / 打印预览 / 导出报表 PDF）在窄窗口下裁掉纸面右侧列
- **现象**：首件单（10 列）导出 PDF 只落到「挤压强度」附近，浊度/压降等右侧列被裁；巡线（12 列）导出 PDF 只落到「表面状态」，跌落/抗压/结果判定/巡线人员被裁（见 `a3-pdf-page.png`、`b5-patrol-page.png` 右侧边缘）。
- **定位**：`frontend/src/core/views/PanelxList.vue:7874-7903` `snapSheetPage()`：截图宽取 `el.scrollWidth`（根元素），但两个纸面组件的横向滚动容器在**内部** —— `QcFirstInspSheet.vue` 的 `.fi-grid-scroll`、`QcLinePatrolSheet.vue` 的 `.lp-grid-scroll`；实测 `.lp-sheet` `scrollWidth=899` 而 `.lp-grid` `scrollWidth=1196`（窗口 974px）⇒ 克隆体仍被内部容器裁切。
- **最小复现**：5173（测试库）打开 `XJ-2026-11-0003`（窗口宽 ≈974px）→ 侧栏「导出」→「导出 PDF」→ PDF 页图只到「表面状态」列；把窗口拉宽到 ≥1200px 再导出可全（根因是截图宽而非版本）。
- **期望 vs 实际**：期望纸面全宽（12 列 / 10 列）进 PDF；实际右侧列丢失。
- **影响**：仅客户端截图 PDF；**服务端 Jasper PDF（A4）完整无此问题**。first-insp 的 `.fi-grid-scroll` 自 2026-10-16 起就有（历史行为），patrol 属同型新引入。TASK A3/B5 判据（非空白/进白名单）不受影响，故不判 FAIL；建议 Lead 评估是否本任务内修（修法：`snapSheetPage` 克隆时把内部滚动容器 `overflow:visible` 且宽度设为子表 `scrollWidth`）。

### 说明-1 「导出报表」PDF 对这两张单走客户端纸张渲染（既有口径，非本轮引入）
- `PanelxList.vue:8696` `sheetPreviewUsesPaper` 对 `QC_FIRST_INSP`/`QC_LINE_PATROL` 为真，`downloadReport('pdf')` → `buildSheetPdfBlob()`（与打印同源）。所以 UI「导出报表→导出 PDF」拿到的是客户端纸面截图；**服务端 Jasper 版式**要用 `/api/report/export`（本轮 A4 即用此通道取证，PDF 完整 842×595）。这与 2026-10-21 的既定决定一致，记录以免后人误解「导出报表就是 jrxml」。

### 说明-2 首件单 Excel 导出的「标准」行空值也写 `/`
- `a3-export.xlsx` 标准行 10 格全 `/`（该单标准值均为空）；数据区样品行 `/` 恰 60。属既有导出约定（空值渲染 `/`），与契约「其余列照旧」不冲突，仅记录。

### 说明-3 A2 首次保存被前端校验拦下（正常业务校验，非缺陷）
- 直接点「新增」后不选工单保存 → 提示「工单号不能为空」，不落库；正确路径是「选生产工单」生成草稿后再保存（A2 即按此路径通过）。

---

## 5. 测试造数清理状态

| 库 | 单号 | 用途 | 处置 |
|---|---|---|---|
| HSDZ_MES（正式） | `SJ-2026-11-0009` / `SJ-2026-11-0010` | 点「新增」产生的空草稿 | **已删**（head/detail/doc_status） |
| HSDZ_MES（正式） | `SJ-2026-11-0011` | A2/A4 真落库用单（90 明细行） | **已删**（head/detail/doc_status） |
| HSDZ_MES_TEST（测试） | `XJ-2026-11-0003` | B3/B4/B5 用单（3 明细行） | **已删**（head/detail/doc_status） |
| HSDZ_MES_TEST（测试） | `SJ-2026-11-0009` | A1 勾选取证点「新增」的空草稿 | **已删** |
| HSDZ_MES_TEST（测试） | `XJ-2026-11-0001` / `XJ-2026-11-0002` | 实现方 patrol-sheet 的测试数据（非本次验收所造） | **保留未动**（只读态取证时临时改过 0001 的 `yj_doc_status.shr`，已还原 NULL） |

- 清理脚本与输出实录：`_cleanup-prod.sql`、`_cleanup-test.sql`、`_cleanup-evidence.txt`（删前/删后行数均有打印：删前 3 单/91 明细行 → 删后 0；正式库最新单据回到 `SJ-2026-11-0008`）。
- 号池已消耗的流水号（SJ-2026-11-0009~0011、XJ-2026-11-0003）**不回退**（正常业务行为，不属脏数据）。
- 正式库巡线面板无单据（0 行，实现方已清零）——本次未在正式库造巡线数据。

---

## 6. 未验项与原因

| 项 | 原因 |
|---|---|
| B6 其它 9 种语言逐语言走查 UI | 契约只要求「至少 en」；已做 en 界面实测 + 10 个语言包静态词条核对（缺 zh-CN 属源语言正常）。 |
| 巡线「审批流 / 导出 Excel」 | 契约 §一 明确「本期不做审批流/导出 Excel」⇒ 不属于本期验收范围。 |
| 浏览器原生「打印」对话框（点「打印」→ window.print） | ego 环境会弹浏览器原生打印预览（browser prompt，属用户/系统控制），改用等价且可复现的两条通道取证：①导出 PDF（同一渲染源）②导出报表→打印预览（新窗口 PDF）。 |
| A4 在 5173 上做 | A4 验收对象是**服务端报表**，必须在 8090 新 jar 上做；5173 反而不经服务端。Lead 换包后已按 8090 完成。 |
| 8090 正式库巡线「新建草稿」流程 | 按 Lead 口径「不用在正式库造数，打开即可」；12 列纸面渲染改在测试库单 `XJ-2026-11-0003` 上复核（8090 已切测试库实测）。 |

---

## 7. 证据文件索引（全部在本目录）

| 类别 | 文件 |
|---|---|
| 任务单 | `TASK.md` |
| A1 | `a1-evidence.json`、`a1-checkbox.json`、`round-01.mjs`、`round-02.mjs`、`round-33.mjs`、`round-02-first-insp-full.png`、`round-33-checkbox.png` |
| A2 | `_a2-db-evidence.txt`、`a2-save-wire3.json`、`_a2-verify.sql`、`round-03/09/10*.png`、`round-09.mjs`、`round-10.mjs` |
| A3 | `a3-export.xlsx`、`a3-export.pdf`、`a3-pdf-page.png`、`_a3-analyze.py`、`_a3-analyze.log`、`_pdf-image.py`、`_a3-pdf-image.log`、`round-11*.png`、`round-11.mjs` |
| A4 | `a4-server-report.pdf`、`_a4-server-text.txt`、`_a4-analyze.py`、`_a4-analyze.log`、`round-20-a4-server-report.png`、`round-19.mjs`、`round-20.mjs` |
| B1/B2 | `b1-click.json`、`b1b2-paper.json`、`round-25*.png`、`round-21*.png`、`round-21.mjs`、`round-25.mjs` |
| B3/B4 | `b3b4-save.json`、`b4b5.json`、`_b4-db-evidence.txt`、`_b4-check.sql`、`round-26*.png`、`round-27*.png`、`round-26.mjs`、`round-27.mjs` |
| B5 | `b5-patrol.pdf`、`b5-patrol-page.png`、`_b5-pdf-image.log`、`round-28.mjs`、`round-29.mjs`、`round-29-print-preview.png`、`b5-preview.json` |
| B6 | `b6-en.json`、`round-30-menu-en.png`、`round-30-patrol-en.png`、`round-30.mjs` |
| 只读态 | `b-readonly.json`、`round-35-patrol-readonly.png`、`_readonly-set.sql`、`_readonly-restore.sql` |
| 8090 打包版 | `b8090-patrol.json`、`b8090-patrol2.json`、`round-17-8090-first-insp.png`、`round-31-8090-patrol.png`、`round-32-8090-patrol.png`、`round-17.mjs`、`round-31.mjs`、`round-32.mjs` |
| C1/C2 | `_build-frontend.log`、`_c1-node-test.log`、`_build-backend.log` |
| C3 | `_c3-check.sql`、`_c3-HSDZ_MES.log`、`_c3-HSDZ_MES_TEST.log`、`Q.java` |
| C4 | `_c4-git-status.txt` |
| C5 | `_c5-matrix.mjs`、`_c5-matrix.log`、`_c5-impl-matrix.log` |
| 清理 | `_cleanup-prod.sql`、`_cleanup-test.sql`、`_cleanup-evidence.txt`、`_cleanup-probe.sql` |
| 第十一轮补验 | `_r11-matrix.mjs`/`.log`、`_r11-db.sql`/`.log`、`_r11-cleanup-test.sql`/`_r11-cleanup.log`、`r11-dom.json`、`r11-dom-8090.json`、`r11-save2.json`、`r11-report-server.pdf`、`r11-report-server.txt`、`r11-report-ui.pdf`、`round-40..46.mjs` |
| 环境 | `_ego-skill.md`（ego-browser 用法快照）、`round-12..18/22/23/24` 等过程脚本 |

> 复跑方式：ego 脚本 `ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/verify-20261114/round-NN.mjs')"`（脚本已拷入本目录，可直接放回该路径复跑）；DB 查询 `java -cp tools/lib/mssql-jdbc.jar tools/archive/_verify-20261114/Q.java <DB> <sql>`；矩阵 `node tools/archive/_verify-20261114/_c5-matrix.mjs`（第十轮）、`node tools/archive/_verify-20261114/_r11-matrix.mjs`（第十一轮）。

---

## 8. 第十一轮补验（2026-11-15 · 挤压强度上移到 5#/6#）：**PASS（3/3）**

> 用户 2026-11-15 口径：「帮我把挤压强度的格子提上去一行」→ 追问后选「和跌落强度同一对样品行」。
> 现行矩阵唯一变化：**挤压强度 可填行 7#/8# → 5#/6#**；其余不变（表观/脱粉 1#/2#、外径/内径/长度/重量 3#/4#、跌落 5#/6#、浊度NTU/压降kPa 7#/8#）；合计仍 **可填 20 / `/` 60**。
> 新包：8090 jar SHA256 `6fa1cf34…`（Lead 公布 `6FA1CF34…`），static `index-Dc3ViIde.js`，2026-11-15 00:05 重启；本地单测 65/65（验收者复跑确认）。

### 8.1 5173 DOM（测试库，`SJ-2026-11-0010` 草稿）：**PASS**
证据：`r11-dom.json`、`round-43.mjs`（`round-40/42` 为过程脚本）、`_r11-matrix.log`

| 判据 | 期望 | 实测 |
|---|---|---|
| `td.gz-y` 总数 | 20 | **20**，色唯一值 `rgb(255, 243, 202)` |
| `/` 只读格 | 60 | **60**（8 行×10 列 = 80 − 20） |
| 挤压强度列可填行 | **5#、6#** | **`compressRows=[5,6]`**；5#/6# 格 = 黄底 + input |
| 7#/8# 挤压格 | `/` 且无输入控件 | `text="/"`、`hasInput=false`、`boxes=0`、`bg=transparent`（白底） |
| 7#/8# 挤压格 title | 本列两行（5#、6#） | **`按相关要求：本组测试只记录 2 支样品（5#、6#）`** |
| 其余列未变 | 表观/脱粉 1/2、尺寸 3/4、跌落 5/6、浊度 7/8、压降 7/8 | **逐列一致**：`炭棒表观状态:1/2、炭棒脱粉情况:1/2、炭棒外径:3/4、炭棒内径:3/4、炭棒长度:3/4、炭棒重量:3/4、跌落:5/6、浊度NTU:7/8、压降kPa:7/8` |
| 标准行 | 2 个 `td.std-check`、灰 `rgb(217,217,217)`、无控件 | **2 / `rgb(217, 217, 217)` / 0 个 input,textarea** |
| 合计 | 可填 20 | **fillableTotal = 20** |

静态同源复核：`node tools/archive/_verify-20261114/_r11-matrix.mjs`（期望矩阵手抄契约 §一 第十一轮）→ `[PASS] frontend 列模型 + Excel 导出与契约 §一 逐格一致(可填 20 / 斜杠 60)`，且导出同源（可填格落值 20 / `/` 60）。

### 8.2 真落库（测试库）：**PASS**
证据：`_r11-db.log`（SQL 输出实录）、`r11-save2.json`、`_r11-db.sql`

- 在 挤压强度 **5#** 填 `32.5` → 保存：UI 提示「「保存」成功」（`r11-save2.json` AFTER.msgs），单号 **`SJ-2026-11-0010`**（单据日期 2026-11-15、工单号 MO-2026-09-0108、admin、00:07:24）。
- `qc_first_insp_detail` 该单 90 行；`compress` 列逐行：**仅 `5#` = 32.5**，`1#~4#/6#/7#/8#/标准` 全 null；全单「实测数值非空」**只有这 1 格**。
- 保存后页面取值：挤压 5# = `32.5`、6# 空、**7#/8# = `/`**（无输入框）——`r11-save2.json` valuesAfter。
- 造数已清理：`_r11-cleanup-test.sql` / `_r11-cleanup.log`（删前 head 1 / detail 90 / doc_status 1 → 删后全 0；测试库最新单据回到 `SJ-2026-11-0007`）。

### 8.3 8090 新 jar DOM + 导出报表服务端 Jasper PDF：**PASS**
证据：`r11-dom-8090.json`、`r11-report-server.pdf`、`r11-report-server.txt`、`r11-report-ui.pdf`、`round-44.mjs`

- **8090 DOM**（测试库同一单 `SJ-2026-11-0010`）：`gzY=20`、`/`=60、`stdCheck=2`、挤压可填行 = **5#/6#**、5# = `32.5`、7#/8# 挤压格 = `/` 无输入且 title = “（5#、6#）”；10 列表头与 5173 一致（`r11-dom-8090.json`）。
- **服务端 Jasper PDF**（`/api/report/export?code=qc_first_insp&panelCode=QC_FIRST_INSP&docNo=SJ-2026-11-0010&format=pdf`，`r11-report-server.pdf` 95,296 B）：
  - `/Type /Page` = **1**；`/MediaBox[0 0 842 595]`（A4 横向）；**无内嵌图片**（矢量文本）；
  - 内容流取色：**黄 `1 0.95294 0.79216 rg`（#FFF3CA）恰好 20 次**、**灰 `0.85098 0.85098 0.85098 rg`（#D9D9D9）恰好 2 次**；
  - 文本层（openpdf 抽取，1,514 字）：两级表头 + 标准行 + 1#..8# 齐全；**`5#` 行含 `32.5`（落在「挤压强度」列位）**，`6#/7#/8#` 行无挤压值（`r11-report-server.txt` 第 5# 行 = `/ / / / / / 32.5 / /`，7#/8# 行无该值）。
- 备注：UI「导出报表→导出 PDF」对首件单仍按 2026-10-21 既有口径走**客户端纸张渲染**（`r11-report-ui.pdf`：595×842 单页图、无颜色算子、无文本层）——与 §4 说明-1 一致；**服务端 Jasper 版式**经上面的 API 通道取证（判据要求全部满足）。

### 8.4 本轮未取得的东西（说明）
- 本轮 ego 浏览器截图通道异常（`Page.captureScreenshot` 连续超时；页面本身可正常 evaluate/取 DOM），因此 §8 无新截图，界面证据以**结构化 DOM JSON**（`r11-dom.json` / `r11-dom-8090.json`）为准；PDF 证据见 `r11-report-server.pdf`（可用任意 PDF 阅读器打开复核）。上一轮同页面的视觉截图可参照 `round-02-first-insp-full.png`。
- 本轮未改实现、未 git add/commit、未重启 5173/8090；测试任务空间 `verify-20261114-r11` 已按规范关闭。

