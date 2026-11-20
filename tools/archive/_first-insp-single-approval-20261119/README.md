# 首件检验记录表：去掉「批准」格 + 相关要求按受控表单十条换版（2026-11-19）

## 用户口径（原话）

> **1.格式优化**
> 没有二级审核，只需要审核人就行，去掉批准人。
>
> **2.流程**
> 审批流程：录单人录入信息→保存提交审批→审批人确认后进行归档。

截图红字两处（随任务一并处理）：

| 截图标注 | 落点 |
|---|---|
| 「描述文字未修改」（指向纸面《相关要求》） | 旧六条是照早期截图誊的，与受控表单原文不一致 ⇒ 按用户给的图 2 **十条**逐字替换（用户已核对无误） |
| 「没有二级审核，去掉批准流程」（指向表尾「批准」格） | 表尾四段 → 三段：**检验结果 \| 检验人 \| 审核人** |

补充确认（本轮问答）：

- 「归档」不引入新状态机 —— 用户口径「**就是不要二级审批了**」⇒ 审批形态维持 2026-11-09 起的**单级**
  （提交审批 → 审批通过 → 已审核），不把本单加进 `DOC_ARCHIVE_PANELS`，不动弃审/归档闭环。
- 新第 7 条「所有测试均按照检测设备的实际读数进行记录数据」与旧第 2 条「保留小数点后 1 位」冲突，
  用户选「**改成按实际读数记录（去掉自动取整）**」。

## 改了什么（三处同源，别只改一处）

| 位置 | 改动 |
|---|---|
| `frontend/src/core/qc/QcFirstInspSheet.vue` | ① 表尾删「批准」th/td（四段 → 三段）；② `REQUIREMENTS` 六条 → **十条**；③ 删 `precisionOf / normalizePrecision / precisionHint` 与失焦取整调用，录入格只留 title「按检测设备的实际读数记录」；④ 注释里「第 2/4/6 条」改「第 7/8/10 条」 |
| `frontend/src/core/qc/firstInspExport.js` | 表尾 `footPairs` 四段 → 三段（`bounds` 按 `N/3` 重算）；注释同步 |
| `frontend/src/core/qc/firstInspExport.test.js` | ⑤ 用例改三段（N=11 ⇒ 标签列 0/4/8、值格合并 1-3 / 5-7 / 9-10），并断言表尾**不出现「批准」** |
| `frontend/src/i18n/locales/en.js` | 补十条新文案的 en 词条（第 9 条原文未变，沿用既有词条）+「按检测设备的实际读数记录」 |
| `backend/src/main/resources/reports/qc_first_insp.jrxml` | summary：十条（y=14..140，band 高 126 → **176**）+ 表尾三段（x=0/260/520，宽 70+190/190/192）；参数契约删「审批人」 |
| `backend/.../service/QcFirstInspReportSupport.java` | 参数清单与 `params()` 删「审批人」（模板不再引用 `$P{审批人}`） |
| `frontend/src/core/views/PanelxList.vue` | 只改注释：补 2026-11-19 更正段（纸面删批准、审批仍是单级、按钮组不变） |
| `docs/design/首件检验单-*.md` | 相关要求落地（六条→十条映射表 + 取整规则作废）、报表模板、打印导出、取工艺清单、直接选工单里的序号同步 |

**没动的**：审批代码（`SINGLE_LEVEL_INSP_PANELS` 2026-11-09 起已是单级）、`yj_field` 元数据（表尾三格本来就不是字段）、
数据库结构（零迁移）。

## 验证证据

### ① 前端单测（163 项全过）

```
cd frontend && node --test src/core/qc/*.test.js
→ 1..163 / pass 163 / fail 0
```

> 全量 `npm test` 另有 6 项失败，**与本任务无关**：5 项 `recordSheetConfigs.livedb.test.js` 要调 `SQLCMD.EXE`（本机没有），
> 1 项 `sheetPrintAllTabs.test.js` ⑥ 是上一提交 `02b00f8cf`（仪器使用记录表加汇总页签）把 `RD_INSTR_USE` 加成多页签后
> 没同步期望表 —— 本任务未改该文件。

### ② 服务端报表离线冒烟（42 项全过，不启动后端、不碰库）

```
cd backend && mvn -o -s ../tools/settings.xml -q -DskipTests compile
cd backend && mvn -o -s ../tools/settings.xml -q dependency:build-classpath -Dmdep.outputFile=target/cp.txt
cd .. && CP="backend/target/classes;$(tr '\n' ';' < backend/target/cp.txt)"
"C:/Users/vigna/.jdks/ms-25.0.4/bin/java" -Dstdout.encoding=UTF-8 -cp "$CP" \
  tools/archive/_first-insp-single-approval-20261119/_FirstInspReportSmoke.java
→ 42 PASS / 0 FAIL · SMOKE OK
```

断言覆盖：参数里**没有**「审批人」、summary 静态文案逐字含十条、表尾只有 检验结果/检验人/审核人、
任何静态文案都不含「批准」、文本域不引用 `$P{审批人}`、填充后仍 **1 页**、导出 xlsx 十条齐全且**没有一个「批准」单元格**。
产物：`_first-insp-report-single.pdf` / `.xlsx`（本目录）。

### ③ 界面实测（ego 浏览器，5173 源码版）

| 证据 | 结论 |
|---|---|
| `ego/round-02-paper.png`（正式账套 SJ-2026-11-0008 只读纸面） | 《相关要求》= **10 条**，文本与受控表单逐字一致；`.fi-foot` = 检验结果 / 检验人 / 审核人（**无批准**） |
| `ego/round-26-paper-bottom.png`（测试账套，缩放后整张纸） | 十条 + 表尾三段全貌；页面文本里**不出现「批准」**（`bodyHasApprover=false`） |
| `ego/round-08b-filled.png`（测试账套 3# 外径） | 输入 `34.25` 失焦后仍为 **34.25**，无取整提示（旧规则会变 34.3） |
| API 走单级审批（`ego/round-20.mjs`，测试账套 SJ-2026-11-0013） | `提交审批 → 单据状态=审批中`；`审批通过（一次）→ 已审核`；**无「待二级审批」节点** |
| `ego/round-28-8090.png`（**打包版** 127.0.0.1:8090，jar 内 static） | 同样是 10 条 + 表尾三段 + 页面无「批准」⇒ `rebuild-prod.ps1` 出的 jar 已带本轮前端与报表模板 |

审批落库取证（`q-approve-proof.sql`，HSDZ_MES_TEST）：

```
qc_first_insp_head   审核人=系统管理员 审核时间=2026-11-19 16:06:13  审批人=null 审批时间=null
yj_doc_status        shr=admin  pending=N  approve_node=1  l2_approver=null
yj_form_approval     SUBMIT/PENDING(n1) → APPROVE/APPROVED(n1)   ← 只有一级
```

### ④ 造数清理（§5.9）

测试账套造的单据 **SJ-2026-11-0012 / SJ-2026-11-0013** 已删净（`cleanup.sql` 输出）：

```
before: head=2 detail=90 status=2 trail=2 flowlink=0 annot=0
after : head=0 detail=0  status=0 trail=0
```

正式账套**零写入**（只读打开过 SJ-2026-11-0008）。

## 追补（2026-11-20）：相关要求第 8 条「表现」→「表观」

用户再给一张《相关要求》特写（8/9/10 三条红字），口径「下方的提示内容红字也修改了」。
逐字核对后：红字三条里 **只有第 8 条的首词与系统不一致** —— 受控表单是「炭棒**表观**出现…」，
而 11-19 那轮按低清图誊成了「炭棒**表现**出现…」（第 9、10 条逐字一致）。

改法：所有副本同步（`QcFirstInspSheet.vue` 的 `REQUIREMENTS` + 注释、`qc_first_insp.jrxml`、
`en.js` 词条键、本目录冒烟脚本的期望数组、设计文档的映射表）。停产红幅正文本来就用「表观」，无需改。

复验：`node --test src/core/qc/*.test.js` → 173 pass / 0 fail；
离线冒烟 → **42 PASS / 0 FAIL**（产物 PDF/xlsx 已用订正文案重新生成）；
8090 打包版实测（`ego/round-30-typo-8090.png`）第 8 条为「炭棒表观出现…」，页面里 `表现` / `批准` 均为 0 次。

> ⚠ 仓库内 `backend/src/main/resources/static` 本次**未提交**：重建静态产物时工作区里还有另一个会话
> 未提交的前端改动（「品质流程监控 → 来料品质流程监控」改名等），此刻提交 static 会把别人的半成品带进仓库
> （产物里已确认含 `来料品质流程监控` 字样）。本机 8090 的 jar 已带本轮全部改动，静态产物同步留给那次并发提交一并做。

## 追补二（2026-11-20）：相关要求第 8/9/10 条印红字

用户口径（截图红框 + 「字体还是黑色的」）：受控表单上这三条是**红字**，系统纸面也要照印。

- 面板：新增 `RED_REQ_INDEXES = new Set([7, 8, 9])`（0 基 ⇒ 第 8/9/10 条），`li.is-red { color:#ff0000 }`；
- 服务端报表：`qc_first_insp.jrxml` 新增 `reqRed` 样式（`forecolor="#FF0000"`），第 8/9/10 条套用；
- 浏览器打印共用同一份 DOM/CSS ⇒ 打印件也是红字；
- **Excel 导出带不出颜色**（xlsx 社区版丢单元格样式，见 `firstInspExport.js` 头注）⇒ 导出纸仍黑字，
  要红字用「打印」或「导出报表(PDF)」。

复验：冒烟加 6 条红字断言（第 8/9/10 条 forecolor 红、第 7 条与表尾不是红）→ **48 PASS / 0 FAIL**，
PDF/xlsx 已重新生成；8090 打包版实测 `li` 颜色 = `rgb(255,0,0)`（第 8/9/10 条），
截图 `ego/round-31-red-8090.png`。

再复验（用户 2026-11-20 16:20 又给一张红字特写，口径「按照这个图中的内容对文字进行变红」——
即红字范围确认为第 8/9/10 条，与实现一致）：

- 5173 与 8090 **两个入口**的计算样式都读到 `rgb(255, 0, 0)`（第 8/9/10 条），1～7 条 `rgb(34,34,34)`；
- 打印态（复刻应用 `body.approval-printing`）截图 `ego/round-32`/`round-33` 与用户图逐字一致；
  该状态下 `Page.printToPDF` 出的 PDF 内容流里含红色填充算子 ⇒ 打印件是红字；
- 服务端报表 PDF 里红色算子 = 3 处（一条一处）。

⚠ 仍有两处是黑字且属**已知限制**：① 前端「导出 Excel(.xlsx)」—— xlsx 社区版写不了字体颜色；
② 服务器（36.140.66.163）尚未部署本轮改动。

## 复跑
```bash
cd frontend && node --test src/core/qc/*.test.js          # ①
# ② 见上（需 JDK25 + 已 compile 的 backend/target/classes）
# ③ ego 脚本在本目录 ego/ 下，按 round-01 → round-26 顺序跑（同一 taskSpace「first-insp-approval-20261119」）
```

## 留口子（已知不算缺陷）

- 旧六条的 en 词条仍在 `en.js`（不再被引用）；其余语言未补十条 —— 按 AGENTS §2.1「至少 en」。
- 「先测浊度再测压降」的顺序提示此前已下架（代码里已无 `turbidityPressureTip`），本批未恢复。
- 顶部 C-95 提醒条仍用短句「C-95客户相关产品脱模后立马进行首件检验。」（第 10 条是长句，提醒条不照抄）。
