# 工单排产/生产工单：日期格「原计划 / 报工」+ 当天结束后未完成提示（2026-11-13）

> 用户口径（2026-11-13，附两张截图，红框标在日期列上）：
> 「在这里增加一个原计划量/报工数，当天结束后未完成会进行提示。这种形式，图片中也说明了」
> 「报工后显示在当前位置和原计划量/实际报工量，未达到数量进行提示，未达到计划数量的向后序数量进行处理」
>
> 逐项拍板：①格内两数 `原计划/报工`（例 715/15），未达计划标红；②格子标红 + 页面顶部一行红色汇总
> （「历史未完成 2 处 · 合计欠产 1067」，悬停看明细），不弹窗；③工单排产 + 生产工单**两页都改**。
>
> **2026-11-13 晚用户复看后追加一条口径**：「这里两天的计划量是1067，但是未完成的量不是1067吧，
> 欠缺的数应该是计划量-实际报工数量」——核对现场数：两天原计划 `834+833=1667`、报工 `500+100=600`、
> 欠产 `1667−600=1067`（原提示里的 1067 **本来就是**计划−报工，只是单放一个数容易被读成"计划合计"）。
> ⇒ 顶部提示改为**三数并列**：`历史未完成 2 处 · 原计划 1667 − 报工数 600 = 欠产 1067`，
> 生产工单页同口径（`shortfallTotals()` 回 `{count, plan, actual, qty}`）。
>
> 口径基线文档：`docs/development/日排产-原计划与报工对照.md`（改这两页/该字段前先读）。

## 结论（实测，正式库 HSDZ_MES，8091 = 新 jar）

| 场景 | 结果 |
|---|---|
| 工单排产 · 3号车间 GD-2026-11-0017 | 今天格 `715/15` 绿色，tooltip `原计划 715 · 报工数 15 · 双击直接填当天数量;清空恢复自动`（今天不判未完成） |
| 工单排产 · 1号车间 GD-2026-11-0012 | 11-11 `834/500`、11-12 `833/100` 红色（`rgb(245,108,108)` / 700）；顶部 `历史未完成 2 处 · 原计划 1667 − 报工数 600 = 欠产 1067`（三数并列版，见 evidence-04），悬停两行明细 |
| 生产工单页 | `历史未完成 35 处 · 原计划 11446 − 报工数 600 = 欠产 10846`，可见红格 9 个；今天格 `715/15` |
| 英文（顶栏切 English） | `Past days incomplete 2 entries · Planned 1667 − Reported qty 600 = Shortfall 1067`；格/列头 tooltip 全英文 |
| 降级（5173 源码 + 旧 8090 jar，接口无「原计划」） | 单数 `15`、无汇总条、无报错（不是两数、不造数） |
| 双击改数量 | 今天格预填 **700**（计划值，不是报工 15）；历史红格预填 **834**（原计划）；Esc 取消不落库 |
| 控制台 | 两页零 pageerror |

证据截图（本目录）：

- `evidence-04-banner-3nums.png` — **三数并列版**顶部提示（2026-11-13 晚终态）
- `evidence-01-board-3shop-715-15.png` — 3号车间 11-13 今 格：`715/15`（绿，今天不判未完成）
- `evidence-02-board-1shop-short-cells.png` — 1号车间 11-11/11-12：`834/500`、`833/100` 红色（欠产）
- `evidence-03-board-banner.png` — 旧版单数汇总条（留档：`历史未完成 2 处 · 合计欠产 1067`，已被 evidence-04 取代）
- `final-01-board-3shop.png` — 工单排产 3号车间整屏
- `final-02-board-1shop.png` — 工单排产 1号车间整屏（红色欠产 + 顶部汇总）
- `final-03-list.png` — 生产工单页整屏（汇总 35 处 / 10846）
- `final-04-board-en.png` / `final-05-list-en.png` — 英文版
- `source-zoom-board-3shop.png` / `source-zoom-board-1shop.png` — 50% 缩放整屏（`evidence-01/02` 的裁切源；页面太宽，
  日期列在 100% 缩放下会被左侧固定列遮住，取证时先把页面缩到 50% 再截，见 `ego/round-12.mjs`、`round-13.mjs`）
- `round-01-current.png` — 改前现状（日期格只显示 15，计划 700 只在 tooltip）
- `round-09-5173-degraded.png` — 降级态（5173 + 旧 8090 jar）
- `round-12-edit-prefill2.png` — 双击改数量的预填值

> 说明：`evidence-01/02` 是按「50% 缩放截图 + 像素坐标裁切 + LANCZOS 放大」做的可读性裁图
> （原始整屏在同目录 `source-zoom-*.png`，裁切坐标见各图中标注的列头；没有改任何 DOM/数据）。

## 可复跑步骤

### 1. 纯逻辑 / 纯函数

```bash
# 前端显示层纯函数(15 条;含三数并列新断言)
cd frontend && node --test src/business/dayPlan.test.js

# 后端摊分纯函数(16 条;含「原计划」基线/两本账新校验)
mkdir -p .tmp/dp-test
javac -encoding UTF-8 -d .tmp/dp-test tools/verify/DayPlanSpreadTest.java \
    backend/src/main/java/com/yinjia/mes/service/DayPlanSpread.java
java -cp .tmp/dp-test DayPlanSpreadTest
```

### 2. 起 8091 新实例（含新前端；**必须隔离构建**，见下方「坑」）

```powershell
$env:JAVA_HOME='C:\Users\vigna\.jdks\ms-25.0.4'   # 后端 JDK25;PATH 上的 java 是 1.8
# 用隔离树(HEAD + 本任务改动)构建,避免把并行会话的 WIP 打进产物:
#   git archive HEAD | tar -x -C .tmp/verify-wt
#   把本任务改动的 8 个文件复制进去后:
cd .tmp/verify-wt/frontend; npm run build
# dist → .tmp/verify-wt/backend/src/main/resources/static → 复制 backend/src+pom 到 .tmp/backend-build-v4
cd ../../backend-build-v4; mvn -o -q -DskipTests package
# ⚠ 8091 在跑时 jar 被占用 ⇒ repackage 会「Unable to rename」失败;先停 8091 再 package
& 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe' -Dstdout.encoding=UTF-8 -jar `
  target\yinjia-mes-backend-0.1.0.jar --server.port=8091
```

### 3. API 对账

```bash
node tools/archive/_wo-dayplan-orig-20261113/probe/shortfalls.mjs http://127.0.0.1:8091
node tools/archive/_wo-dayplan-orig-20261113/probe/line-detail.mjs http://127.0.0.1:8091 1号车间
```

`shortfalls.mjs` 逐产线打印 `原计划`/`日计划`/`日报工` 与历史欠产明细（处数 + 合计），
与页面顶部汇总逐字对账；`line-detail.mjs` 打印某条线的日期列与每行计划区间（排查"汇总有欠产但看不到红格"）。

### 4. 界面验收（ego 浏览器）

脚本在 `ego/`（原机路径 `C:/Users/vigna/ego/wo-dayplan-orig-20261113/`，截图输出到同目录）：

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_wo-dayplan-orig-20261113/ego/round-11.mjs')"
```

- `round-01` 改前现状 → `round-02` 工单排产三线 → `round-03` 生产工单 + 英文 → `round-04` 降级/双击/页签
  → `round-05` 双击预填 → `round-10` 入口缓存排查 → `round-11` 终验（两页 × 中英，截图 `final-*`）。
- 登录：`admin / 123456`，工厂 `YJ`（正式库）。

## 口径要点（详见 `docs/development/日排产-原计划与报工对照.md`）

- **原计划**（后端新字段）= 工序计划量按「开工日→交期」**全量均摊**的基线（`DayPlanSpread.merge`），
  **不扣已审报工、历史日期也保留**；与「日计划」（`mergeReported`：扣报工、从今天起重摊）是**两本账**，不可相加。
- 格内：有报工 → `原计划/报工`；没报工（今天/未来）→ 计划；**日期 < 今天** 且原计划 > 0 没报工 → `原计划/0`；
  只有「日期 < 今天」且「报工 < 原计划」才标红（今天不判）。
- 顶部汇总 = 当前行集里所有历史欠产（处数 + 合计），悬停明细最多 15 行；两页口径见文档 §4。
- 「未达到计划数量的向后序数量进行处理」由既有实现覆盖：剩余量 `mergeReported` 向今天起重摊；
  下道工序「可加工量」只认上一道**已审报工**实际量（本次只加显示，不改流转逻辑）。

## 踩过的坑（下次别重复）

1. **8091 在跑时 `mvn package` 必失败**（spring-boot repackage 要 rename jar，Windows 上被 java 占用）：
   `Unable to rename '...jar' to '...jar.original'`。先按 PID 停 8091，再 package，再起。
2. **`mvn package` 不 clean 会把上一版 static 残留带进 jar**（target/classes/static 不删旧 assets）：
   实测 jar 里同时有新旧两个 `WorkOrderBoard-*.js`。发布前要么 `mvn clean package`，要么先清
   `target/classes/static`（本任务验证实例未 clean，不影响功能，但部署包要 clean）。
3. **浏览器会缓存入口 `index.html`**：服务端已对 `/`、`/index.html` 发 `no-cache`，但 ego 里反复
   `page.goto(同 URL)` 仍可能命中旧入口，导致"改了提示语页面没变"的假象。判据：读
   `document.querySelector('script[type="module"]').src` 与 `curl /index.html` 里的 chunk 名对比；
   不一致就用带 `?bust=` 的 URL 强跳（本目录 `round-10.mjs`）。
4. **并行会话共享工作区**：`git status` 会同时出现别的任务的 WIP（本次见到 `PanelxList.vue`、
   `PanelConfigService.java`、`tools/db-migrations.txt` 等）。提交必须按显式路径，
   **不要 `git add -A`**；构建验证用 `git archive HEAD` + 本任务改动的隔离树。
5. **汇总处数可能大于屏幕红格数**（不是 bug）：`buildDates` 只为「日计划/已审报工/工序台账区间」出列，
   老工单没有台账 ⇒ 历史欠产日期没有列，只在顶部汇总 + tooltip 里体现（2号车间实测 25 处 / 1 个红格）。
   汇总条 hint 已写明「汇总含未显示为列的日期」；要改列生成先与用户确认（会复活 2026-10-30 的"历史空列"报障）。
6. **用户此前口径**（2026-11-05）「没报工的历史计划不显示」仍然有效：本次只把 **原计划基线** 拿出来做对照，
   `日计划` 依旧是"扣报工 + 从今天起重摊"，没有把历史剩余计划重新摊回历史列（不会出现 6000 变 12000）。
