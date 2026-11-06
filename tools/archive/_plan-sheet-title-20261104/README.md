# 排单计划纸表:标题/车间列头随工序产线动态(2026-11-04)

一次性取证目录。对应需求:

> 用户 2026-11-04 截工程序「成型车间排单计划」纸表,红框圈住**标题**:
> 「**当前在不同的工序产线显示的这个工序名称也要不同**」。

## 问题

`frontend/src/business/print-formats.js` 里排单计划的标题(`成型车间排单计划`)、
车间列头(`成型车间`)、交期两列(`成型交期 / 成型交期紧迫度`)全部**写死「成型」**。
而工单排产支持成型 / 切炭 / 组装等多条工序产线,打印切炭线的计划时:
标题仍是「成型车间排单计划」、列头仍是「成型车间」,但车间列里印的是「切炭(自动)」——
纸面自相矛盾(用户截图即此)。

## 修复

`frontend/src/business/print-formats.js`:

- 新增 `planSheetShop(rows, opts)` —— 车间名解析,优先级:
  ① `opts.shop`(工单排产页按**选中产线**的 `生产车间` 传,最准)
  ② 行内唯一 `生产车间` → `当前工序` → `工序`
  ③ 混打多个工序 ⇒ 空(不冒充某个车间);
- 新增 `planSheetTitle(shop)` —— 车间已知 ⇒ `<车间>车间排单计划`(例:切炭车间排单计划),
  未知 ⇒ 通用「排单计划」;档案值自带「车间」后缀时不会叠成「车间车间」;
- `PLAN_SHEET_BASE_COLS` 的「车间/交期/交期紧迫度」三列支持 `tOf(shop)` 动态列头
  (切炭车间 / 切炭交期 / 切炭交期紧迫度…);
- `schedPlanSheetHtml(rows, dates, opts)` 用同一份解析决定纸表标题与列头;
  `printSchedPlanSheet` 同步把它用作 `document.title`(打印页眉 / 另存 PDF 默认文件名)。

`frontend/src/views/modules/plan/WorkOrderBoard.vue#printPlanSheet`:
按**左侧选中产线**在 `linesSummary` 里的 `生产车间` 传 `shop`(没选线时交给行内推导)。

## 验证

1. **单测**(`frontend/src/business/print-formats.test.js`,node 直跑 18/18 PASS):
   - `planSheetShop` / `planSheetTitle` 解析与边界(混打、显式覆盖、自带后缀);
   - 切炭纸:标题 `切炭车间排单计划`、列头 `切炭车间/切炭交期/切炭交期紧迫度`,且**不再出现**「成型」列头;
   - 成型 / 组装纸同理;混打多工序 ⇒ 通用「排单计划 / 生产车间 / 交期」;
   - 出纸入口 `document.title` 记录里能看到 `切炭车间排单计划`(打印页眉同口径)。
   - 运行:`cd frontend && node src/business/print-formats.test.js`
     (⚠ 本沙箱 `node --test`/`npm run build` 会因 esbuild / child_process spawn EPERM 失败,故用 node 直跑文件。)
2. **渲染样例**:本目录 `title-samples.txt` 是 `_render-title-samples.mjs` 的真实输出(6 种场景的标题/表头);
   `_render-title-samples.mjs` 还会把 HTML 写到 `D:\workspace\yinjia\.tmp\plan-sheet\*.html`(临时,不入库)。
3. **未做(沙箱限制)**:headless 浏览器截图(Edge 报 `OpenProcess 拒绝访问`)、`npm run build`(esbuild spawn EPERM)。
   纸面最终效果请在宿主侧验收:5173 → 工单排产 → 选「切炭(自动)」→ 勾选行 → 点「排单计划」看打印预览。

## 生效 / 部署

- **5173(vite 源码态)**:保存源码即 HMR 生效,刷新页面即可看新标题(无需构建)。
- **8090(jar 内置 static)**:纯前端改动,需要宿主侧
  `cd frontend && npm run build` → `pwsh -File tools\scripts\apply-frontend-only.ps1 -NoBuild`
  (脚本会停 8090 换 jar 内 `BOOT-INF/classes/static` 再起;`-NoBuild` 复用刚构建的 dist),
  或整包 `tools\scripts\rebuild-prod.ps1`。
  ⚠ 本 agent 沙箱无权限停/换宿主会话的 8090,也未能在沙箱内构建前端 ⇒
  `backend/src/main/resources/static` 的静态产物同步留给宿主构建后按仓库习惯单独提交
  (`chore: 前端静态产物同步(...)`)。
- 服务器:随下一次增量部署换 jar(前端已打进 jar 的 static),并在 `deploy/部署台账.md` 记账。
