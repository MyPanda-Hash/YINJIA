# 生产工单日期范围控件 + 大范围分页防卡 —— ego 浏览器验收证据(2026-11-09)

- 验收人:`verify-ui`(只读验证,未改源码、未 git 操作)
- 任务板:`task-3`
- 地址:`http://localhost:5173`(vite dev,源码即时生效)
- 账号:`admin` / `123456`,登录工厂默认(YINJIA-MES / 正式库 `HSDZ_MES`)
- 浏览器:ego-lite v2.2.0,task space `wo-daterange-verify-20261109`,视口 1058×734
- 本目录:各轮脚本 `round-NN.mjs` + 截图 `*.png`,均可按命令复跑:
  `ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/wo-daterange-verify-20261109/round-NN.mjs')"`
  (原始脚本/截图在 `C:/Users/vigna/ego/wo-daterange-verify-20261109/`,本目录为副本)

## 结论总表

| # | 判据 | 结论 | 关键实测 |
|---|---|---|---|
| 1 | 生产工单页日期范围 = 单个 daterange 控件 + 6 个快捷档 | **PASS** | `.drq-picker`=`el-date-editor--daterange`;两个输入框占位 `开始日期/结束日期`;快捷档 `今日/本周/本月/近 7 天/近 30 天/上月` |
| 2 | 快捷档可用并触发查询 | **PASS** | 生产工单:默认15天 12 条 → 近7天 2 条 → 近30天 39 条(2026-10-11~11-09);订单结转:近30天 81 条 |
| 3 | 分页条:默认100/页、399行=4页、翻页只渲染当页 | **PASS** | 共399条=4页;第2页 100 行,首行 `GD-2026-10-0176/行2`(与第1页 0 重叠);第4页 99 行;回第1页 100 行;页大小档位 `[50,100,200]`,50/页=8页 |
| 4a | 表格渲染行数 ≤ 100 | **PASS** | 大范围查询后实际渲染 **100 行 × 119 列**(88 固定列 + 31 日排产动态列) |
| 4b | **大范围查询 5 秒内恢复可交互** | **FAIL** | 冷启动查询 3 样本:**10.74s / 11.27s / 11.50s** 才完全稳定,主线程最后长任务结束 **10.24s / 10.68s / 10.67s**;最长单长任务 **5.55~6.0s**。暖态重查 @100:**7.85s / 10.09s**;第2页点刷新:**12.58s** |
| 5 | 订单结转页回归(同一控件/默认[今天,今天]/空表提示不变) | **PASS** | 组件实例链 `ElDatePicker → DateRangeQuery → OrderConvert`;props `modelValue=['2026-11-09','2026-11-09']`、`clearable=false`;宽 260px;空表提示 +「没有数据」确认框与改前一致;近30天 81 条 |
| 6 | 查询→状态筛选 / 翻页→刷新 均回第 1 页 | **PASS** | 第2页→`未完工`:`activePage=1,pageNo=1`;第2页→`已完工`:`activePage=1`(筛选结果 0 行);第2页→`刷新`:`activePage=1,pageNo=1`(动作本身 12.58s,行为正确但慢) |
| 7 | 控制台无新增报错 | **PASS** | 页面内钩子(round-06/07):0 error;CDP `Runtime.consoleAPICalled/exceptionThrown/Log.entryAdded`(round-09):整页加载 1515 事件 0 error、交互期 14 事件 0 error、再次加载 1241 事件 0 error(仅 dev 期 warning) |
| 8 | 跨页勾选回归 | **PASS** | 第1页勾 1 行(`GD-2026-11-0009#1`,`结案`按钮由 disabled→enabled)→ 第2页 checked=1(同 key)→ 回第1页该行 `is-checked`、checked=1;随后取消勾选归 0 |

## 第 4b 项(FAIL)详情

### 复现步骤
1. 打开 `http://localhost:5173/#/prod/plan/workOrderList`(默认 15 天窗口,12 条);
2. 点日期范围控件,把两端填成 `2020-01-01` / `2030-12-31`(或点开两个月面板选到该区间),回车/`查找` 触发查询;
3. 从触发时刻起量:页面 `PerformanceObserver` 长任务 + 行数/首行稳定 + 请求完成;结果见下。

### 实测(冷启动,默认 100 条/页,共 399 条)

| 样本 | 触发→完全稳定 | 主线程最后长任务结束 | 长任务合计 | 最长单长任务 | 渲染行×列 |
|---|---|---|---|---|---|
| round-04 | 11.50s | 10.67s | ≈10.05s | 5.98s | 100×119 |
| round-05(样本2) | 11.27s | 10.68s | ≈10.09s | 5.77s | 100×119 |
| round-06(样本3) | 10.74s | 10.24s | ≈9.69s | 5.55s | 100×119 |

暖态(同一区间再点`查找`):7.85s / 10.09s;第2页点`刷新`:12.58s。

### 耗时结构(round-05/06 资源计时 + 长任务时间线)
- 后端/网络**不是瓶颈**:`/api/px/workOrderList` 真实 314~328ms、`/api/px/scheduleBoard/dayPlan/data` 真实 429~445ms(资源计时;XHR loadend 显示的数秒是主线程被渲染占住导致回调延迟);
- 主线程长任务(样例 round-06):`1.75s`(100 行×88 固定列首次渲染)→ `5.55s`(dayPlan 返回后多了 31 个日排产列,整表重渲 100×119)→ `1.95s`(dayPlan 行数据应用再渲一次),合计 ≈9.7s;
- 对比改前基线(Lead 实测 >15s):**降了约 30%~40%,但未达 5s 目标**。

### 已定位的可行动数值(供修复决策)
| 场景 | 触发→完全稳定 | 主线程最后长任务结束 | 行数 |
|---|---|---|---|
| 大范围查询 @页大小 100(默认) | **10.74~11.50s** | 10.24~10.68s | 100 |
| 大范围查询 @页大小 50 | **4.08~4.16s** ✅ | 3.50s | 50 |
| 暖态重查 @页大小 50 | **4.57s** ✅ | 4.04s | 50 |
| 暖态重查 @页大小 100 | 7.85~10.09s ❌ | 7.29~9.51s | 100 |

⇒ 渲染行数是主因且**非线性**:100 行/页时慢到 10s+,50 行/页时已满足 5s 判据。
若必须保持「默认 100/页」,需要再优化渲染路径(如把「主查询 + dayPlan」两段渲染合并为一次、`rows` 用 shallowRef 降 reactive 化成本、日排产列懒渲染/虚拟滚动);若允许把默认页大小改为 50,则本轮硬指标即可通过(但这是用户口径变更,需确认)。

## 次要发现(不计入 8 项判据,仅供参考)
- `DateRangeQuery.vue` 的 scoped 规则 `.drq-picker[data-v-d636bc67]{ width:250px }` 在浏览器样式表里存在,但 el-date-picker 根元素没有 `data-v-*` 属性 ⇒ 规则不命中:生产工单页控件实际宽 **402px**(Element Plus daterange 默认宽);
  订单结转页传了内联 `style="width:260px"` 所以是 260px(观感不变)。纯样式问题,不影响功能。
- 订单结转页默认「今天」无数据时会自动弹「没有数据 … 留在本日/跳转」确认框(改前既有行为,round-07 首次点控件被它拦截,round-08b 已按「留在本日」关闭后继续验收)。

## 脚本 ↔ 截图索引
| 轮次 | 脚本 | 主要截图 | 覆盖判据 |
|---|---|---|---|
| 01 | round-01.mjs | round-01-picker-open.png / round-01-default.png | 1 |
| 02 | round-02.mjs | round-02-shortcut-30d.png / round-02-wide-range.png | 2、4 预演 |
| 03 | round-03.mjs | round-03-big-range-after.png / round-03-big-range-requery.png | 4(首测,含失败复现) |
| 04 | round-04.mjs | round-04-bigrange-page1.png / round-04-pagination-page2.png / round-04-pagination-page4.png / round-04-page-sizes.png / round-04-pagesize-50.png | 3、4 |
| 05 | round-05.mjs | round-05-sample1-big-query.png / round-05-sample2-big-query.png / round-05-page2.png / round-05-filter-unfinished.png | 4(复核) |
| 06 | round-06.mjs | round-06-sample3-big-query.png / round-06-filter-unfinished.png / round-06-filter-finished.png / round-06-refresh-back-page1.png / round-06-selection-*.png / round-06-shortcut-30d-clean.png | 2、4、6、7、8 |
| 07 | round-07.mjs | round-07-wo-picker-panel.png / round-07-wo-7d.png / round-07-wo-30d.png | 2(干净截图) |
| 08a | round-08a.mjs | round-08a-diagnose-overlay.png | 5(诊断「没有数据」框) |
| 08b | round-08b.mjs | round-08b-oc-default.png / round-08b-oc-picker-panel.png / round-08b-oc-30d.png | 5 |
| 09 | round-09.mjs | round-09-bigrange-page50.png | 7(CDP 控制台)+ 50/页补充测量 |
| 10 | round-10.mjs | round-10-cold-wide-100.png / round-10-requery-100.png / round-10-requery-50.png | 4 对照(100 vs 50) |

## 只读声明
全程只做了:打开页面、查询、快捷档、翻页、页大小、状态筛选、勾选(已取消)、查控制台;未点结案/切单/打印/排产/保存/删除等任何写操作,未改源码,未 git 操作。

---

# T4/T5 复测(2026-11-09 16:20-16:30,修复后)—— FAIL #4b 已转 PASS

- 触发:T3 的 #4b(冷查询 ≤5s)判 FAIL 后,Lead 按复测数值修复(T4,任务板 task-4):
  ① `WorkOrderList.load()` 改为「先取 dayPlan、把日计划/日期列/今天并进**未上屏**的行对象,最后才 `rows.value = list`」⇒ 整表只渲 1 次;
  ② 默认页大小 100 → **50**([50,100,200] 保留);
  ③ `DateRangeQuery.vue` 宽度改为 `width` prop(默认 260px)+ 根元素 `:style="{ width, flex:'0 0 auto' }"`,订单结转去掉内联 style。
- 复测环境同 T3(5173 dev / admin / YINJIA-MES 正式库 / ego-lite v2.2.0);**每个样本都 `page.goto` + `page.reload()` 整页刷新**,等 5s 确认「12 行/共 12 条/50条每页」后再触发大范围查询;
  测量口径与 T3 round-04/05/09 完全一致(PerformanceObserver longtask + XHR 时间线 + 行数稳定 6 次×100ms + 近 500ms 无长任务)。
- 脚本:`round-11.mjs`(3 个冷查询样本)、`round-12.mjs`(7 项回归抽检);数据快照:`round-11-results.json`。

## T4 复测结论:FAIL #4b ⇒ **PASS**(3/3 样本 ≤5s)

| 样本 | 触发→完全稳定(保守口径) | 主线程最后长任务结束 | 长任务合计 | 最长单长任务 | 渲染行×列 | 总页数 |
|---|---|---|---|---|---|---|
| 1 | **4.46s** | 3.89s | 3.09s | 2.15s | 50 × 119 = 5,950 格 | 8 |
| 2 | **4.26s** | 3.69s | 2.89s | 2.04s | 50 × 119 = 5,950 格 | 8 |
| 3 | **4.30s** | 3.75s | 2.96s | 2.03s | 50 × 119 = 5,950 格 | 8 |

- 判据 **≤5s:PASS**(3/3;保守口径含「600ms 行数稳定 + 500ms 静默」余量,真实主线程忙碌约 2.9~3.1s,落定可交互约 3.7~3.9s)。
- 目标 **≤3.5s**:主线程口径 3.69~3.89s,差 0.19~0.39s(未达进取目标,但硬判据通过)。
- 后端仍非瓶颈(resource timing):`/api/px/workOrderList` 350/337/342ms、`/api/px/scheduleBoard/dayPlan/data` 401/422/415ms;长任务只剩 1 段主渲染 ≈2.0~2.15s + 1 段布局 ≈0.78~0.87s。
- 与 T3 对比:冷查询 **10.74~11.50s → 4.26~4.46s**;渲染 **100 → 50 行**;整表重渲 **3 段 → 1 段**;页大小默认 100 → 50。
- 截图:`round-11-sample1-default.png`(刷新后默认 12 行/50条每页)、`round-11-sample1-picker-panel.png`(控件+快捷档)、`round-11-sample1-cold.png` / `round-11-sample2-cold.png` / `round-11-sample3-cold.png`(大范围 399 条/50行每页/8 页)。
- 控件宽度:生产工单页/订单结转页均 **260px**(`round-11-sample1-default.png`、`round-12-oc-default.png`),修复生效。

## T5 回归抽检(7 项):全部 PASS

| 回归项 | 结论 | 实测 |
|---|---|---|
| 控件形态 + 快捷档 | **PASS** | 生产工单页仍为单个 daterange(占位 开始日期/结束日期,宽 260px);快捷档 今日/本周/本月/近 7 天/近 30 天/上月;点「近 30 天」399 条 → 39 条、回到第 1 页(`round-12-shortcut-30d.png`) |
| 分页(399条@50/页=8页) | **PASS** | 共 399 条 50条/页,页码 1 2 3 4 5 6 … 8;第2页 50 行、首行 `GD-2026-10-0204/行1`(与第1页首行 `GD-2026-11-0009` 不同);第8页 **49 行**(=399-7×50,印证总页数 8);回第1页 50 行且首行还原(重叠 50/50)(`round-12-pagination-page2.png` / `round-12-pagination-page8.png`) |
| 筛选回第 1 页 | **PASS** | 第2页 → 「未完工」:`activePage=1,pageNo=1,filteredLen=399,rows=50`;第2页 →「已完工」:`activePage=1,pageNo=1,filteredLen=0,rows=0,共 0 条`(`round-12-filter-unfinished.png` / `round-12-filter-finished.png`) |
| 刷新回第 1 页 | **PASS** | 第2页 → 点「刷新」:`activePage=1,pageNo=1,rows=50`,首行恢复为第 1 页首行(`round-12-refresh-back-page1.png`) |
| 跨页勾选 | **PASS** | 第1页勾 1 行(`GD-2026-11-0009#1`,「结案」由 disabled→enabled)→ 第2页 checked=1 同 key → 回第1页该行 `is-checked`、checked=1;随后取消归 0(`round-12-selection-*.png`) |
| 订单结转页回归 | **PASS** | 组件默认 [2026-11-09, 2026-11-09];宽 **260px**(inline `"width: 260px; flex: 0 0 auto;"`);占位 开始日期/结束日期;快捷档 6 项与生产工单一致;空表提示不变;近30天 → 81 条(2026-10-11~11-09)(`round-12-oc-default.png` / `round-12-oc-picker-panel.png` / `round-12-oc-30d.png`) |
| 控制台 | **PASS** | 本轮全部交互(含 3 次冷查询 + 翻页/筛选/刷新/勾选/快捷档 + 订单结转)页面内钩子记录:**0 error / 0 warning** |

## T4/T5 脚本↔截图索引
| 轮次 | 脚本 | 主要截图 | 覆盖 |
|---|---|---|---|
| 11 | round-11.mjs | round-11-sample1-default.png / round-11-sample1-picker-panel.png / round-11-sample1-cold.png / round-11-sample2-cold.png / round-11-sample3-cold.png(+ round-11-results.json) | #4b 复测(3 冷查询样本)+ 控件/快捷档/宽260 |
| 12 | round-12.mjs | round-12-state-wide-50.png / round-12-pagination-page2.png / round-12-pagination-page8.png / round-12-filter-*.png / round-12-refresh-back-page1.png / round-12-selection-*.png / round-12-shortcut-30d.png / round-12-oc-default.png / round-12-oc-picker-panel.png / round-12-oc-30d.png | 7 项回归抽检 |

## T5 最终判定
**T3 的唯一 FAIL(#4b:大范围查询 5 秒内恢复可交互)已修复通过:3/3 样本 4.26~4.46s(保守口径)≤5s,渲染 50 行×119 列 ≤50,总页数 8;其余 7 项回归全部 PASS。**
(进入 ≥3.5s 的进取目标尚有约 0.2~0.4s 差距,不影响硬判据。)

---

## 截图入库说明

按仓库口径(2026-10-15 用户口径「截图不要入库」,`.gitignore` 的 `*.png`),本文引用的 `round-*.png` **不入库**,
只保留在本地 `C:/Users/vigna/ego/wo-daterange-verify-20261109/`;本目录入库的是可复跑的 `.mjs` 脚本与本文。
