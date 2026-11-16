# 验证任务（Lead 独立验收）· 2026-11-14

> 本任务由 Lead 指派给验证者；所有实现任务（task-1..task-4）已完成或接近完成。
> 契约文档：`docs/design/首件检验单-可填范围.md`、`docs/design/成型车间巡线记录表-首版.md`。
> 不改实现（发现问题只报告 + 给最小复现），唯一允许写的目录：`tools/archive/_verify-20261114/`。
> 禁止 git add/commit；不要重启 5173/8090。界面验证一律 ego-browser（skill('ego-browser') + skill('ego-browser-default')）。

## A. 首件检验单（QC_FIRST_INSP）纸面黄格

A1. 5173 打开 品质管理→制程品质→首件检验单，新建草稿，做 DOM 取证：
- `.sample-row td.gz-y` 数量 = **20**（10 列 × 8 行中可填格）；
- 样品行里显示 `/` 的只读格 = **60**；1#/2# 表观两列是勾选式（可点）、3#..8# 表观列显示 `/` 且无输入控件；
- 标准行 `td.std-check` = **2**，计算背景色 = `rgb(217, 217, 217)`，且这两格无 input/textarea；
- 任一可填格计算背景色 = `rgb(255, 243, 202)`（`#FFF3CA`）；
- 逐列抽查：3# 外径=可填、3# 表观=不可填；5# 跌落=可填而 5# 外径=不可填；7# 挤压/浊度/压降=可填；1# 表观=可填；
- 不可填格 hover title 出现该列自己那两行（如跌落格提示 5#、6#）。

A2. 真落库（用测试库 YJ_TEST 或自建后清理）：在黄格填值（例如 3# 外径 `12.3`、5# 跌落 `50cm`、7# 挤压 `31`），保存成功 → 查 `qc_first_insp_detail`：这 3 个 (检验列,样品序号) 有 `实测数值`，其余不可填格无新值；刷新页面值仍在。若造数请用完清理。

A3. 导出（界面）：侧栏「导出」→「导出 PDF」能出 PDF（非空白页、能截到纸）；「导出 Excel」能下载且不含「行类型/检验列」长表头（可选：解 xlsx 里样品行 `/` 恰 60 个）。不做也可以，注明未验。

A4. 服务端报表（等 Lead 通知 8090 已换包后再做）：打开一张已保存的首件检验单 → 「导出报表」→ 导出 PDF：**1 页**、含两级表头/标准行/1#..8#、黄底可填格能在 PDF 里找到（可用 PDF 文本/取色，或人眼看截图）。

## B. 巡线检验（QC_LINE_PATROL，等 Lead 通知前端实现完成后再做）

B1. 菜单存在：品质管理→制程品质→「巡线检验」；点击能进页面（不被踢回登录页）。
B2. 页面 = 纸面：标题「成型车间巡线记录表」、左「日期」控件、右「审核人」、**12 列表头**（巡线时间/车间/产品信息确认（重点产品标注★）/炭棒长度范围mm/内径检查mm/重量范围g/两液密度（伊玛印品耐水煮要求测试）/表面状态/跌落强度/抗压强度/结果判定/巡线人员），每块 **4 个子行**（编号①/型号① + 三组标准/实测、编号②/型号② + 三组），块级列 rowspan=4；空草稿默认 **3 块**。
B3. 可增删块：点「＋」多一块、「×」删一块（或按组件实际控件描述取证）。
B4. 真落库：填全一块（含①②编号/型号/6 个标准实测值 + 块级 8 格）→ 保存 → 刷新/重开值在 → 查 `qc_line_patrol_head`（单据编号 XJ- 开头、单据日期）与 `qc_line_patrol_detail`（行号 1..n、各字段值与填写一致）。造数用完清理（或注明保留的单号）。
B5. 打印/导出：侧栏「打印」预览/「导出 PDF」至少出一个非空白纸面 PDF（证明 `.lp-sheet` 已进打印/PDF 白名单）。
B6. 英文界面：切 en，菜单与纸面标题/表头不出现裸中文（字段标签走 yj_translation；新 UI 文案走 locales）。

## C. 静态/构建/DB 复核（不依赖界面）

C1. `cd frontend && npm run build` 通过；`node --test src/core/qc/firstInspCols.test.js src/core/qc/firstInspExport.test.js src/business/menus.test.js` 全绿。
C2. `cd backend && JAVA_HOME='C:/Users/vigna/.jdks/ms-25.0.4' mvn -q -DskipTests compile` 通过（⚠ 本机默认 java8/JAVA_HOME=23 会假通过/报发行版本，必须用 JDK **25**）。
C3. DB 两账套都有 `qc_line_patrol_head`/`_detail`、`yj_panel` 1 行 + `yj_field` 30 行 + `yj_role_panel` 授权（正式 13/测试 7）+ 译名缺 en = 0；`tools/migrate-qc-line-patrol-20261114.sql` 两账套 `DbSync sync` 执行 0 失败 0。
C4. `git status` 只应出现本两任务相关文件；`backend/src/main/resources/static` 不应有未提交变更（除非 Lead 做了部署同步）。
C5. 交叉一致性：前端 `sampleRowsOf` / `firstInspExport` / `QcFirstInspReportSupport` 三处矩阵与契约逐格一致（可以直接跑各自的单测/冒烟，别肉眼比）。

## D. 产出

`tools/archive/_verify-20261114/`：README.md（逐条 PASS/FAIL 表 + 证据/SQL/截图/复现步骤）+ ego 脚本与截图（脚本源放 C:/Users/vigna/ego/verify-20261114/）+ 需要修的问题清单（带文件:行、最小复现、期望 vs 实际）。
完成后 team_task_update(complete) + 报告 send_message 给 lead：总 PASS/FAIL、每个 FAIL 的定位与建议、测试造数是否已清理。
