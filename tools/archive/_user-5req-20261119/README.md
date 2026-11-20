# 用户 5 项需求(2026-11-19)

> 用户口径(原文):
> 1. 顺序按照订单数量，生产计划数量，未完成总数，实际完成数量
> 2. 报工记录需要可以选择处所选行导出 excle 就是当前的导出报表需要实现，但是需要增加勾选行。
> 3. 工艺路线中工序控制不需要必填。
> 4. 工单排产中点击修改排单各个日期数量的修改点击触发需要修改，当前只能点击到 / 才能修改。需要修改当前的点击逻辑实现。
> 5. 增加一个未完成数量的查看实现。勾选车间查看当前勾选车间的未完成数量在右下方蓝色边框内。不勾选时右下方时显示当前车间未完成量在右下方。当前存在的应该是在图中存在一个历史未完成量，需要修改为右下方的蓝色框内，当前只实现了单个车间当前查看的情况。

## 改动落点

| # | 改动 | 文件 / 对象 |
|---|---|---|
| 1 | 排单计划纸表固定列顺序改为 **订单数量 → 生产计划数量 → 工序未报工量 → 实际完成数量** | `frontend/src/business/print-formats.js`(`PLAN_SHEET_BASE_COLS`)+ 单测 |
| 2 | 报工记录(WO_REPORT_LIST)加勾选列；「导出报表」改为前端 xlsx：**勾选行 / 全部当前结果** 两个入口，列=当前列设置可见列 | `frontend/src/core/views/PanelxList.vue` + `reportListExport.test.js` |
| 3 | 工艺路线「工序控制」(物理列 `加工方式`)**取消必填**：`yj_field.required → 0` | `tools/migrate-route-process-control-optional-20261119.sql`(已登记迁移链) |
| 4 | 工单排产 / 生产工单日期数量格：整格可点 + 点开自动聚焦输入框(修 `autofocus` 假 prop) | `WorkOrderBoard.vue`、`WorkOrderList.vue` + `workOrderBoardUnfinished.test.js` |
| 5 | 工单排产右下角蓝框「未完成数量」：**勾左侧每条车间(生产线)**=所选车间合计；不勾=当前车间；原顶部「历史未完成」红条并入框内 | `WorkOrderBoard.vue` + 同名单测 |

> 2026-11-20 用户反馈修正第 5 项:「没有完成勾选对应车间,当前实现的是选择的对应**类型**的车间
> (成型/切炭/组装)而不是选择车间;但数量需要区分车间这一点没问题。」⇒ 勾选框从框内的
> 成型/切炭/组装 改为**左侧每条生产线(用户称车间:1号车间/成型1线/…)**上;默认(不勾)=当前选中线。

## 口径说明

- **未完成数量** = 已排未结案 `Σ(排产数量 − 入库数量)`，与页面顶部「总未完成量」同一把尺：
  逐条生产线对 `linesSummary.未交量` 求和。实测(正式库、开工日 2026-11-19)：
  30 条产线合计 **29449** = `/px/scheduleBoard/stats` 的 `总未完成量`；
  成型 23239 / 切炭 6200 / 组装 10。
- 勾选车间 = 左侧每条生产线(1号车间/成型1线/…)；勾几条合计几条；不勾 = 当前选中线；
  未选线 = 全部(等价总未完成量)。
- 报工记录导出 xlsx：标题 + 公司抬头/查询区间 + 当前可见列(与屏幕列设置同源) + 数据行；
  勾选行只导勾中的行(且必须仍在当前结果里)，勾 0 行会提示「请先勾选要导出的行」。
- 日期格编辑：Element Plus 的 `el-input-number` **没有 `autofocus` prop**(写上去只落在根 div，
  浏览器不会聚焦内部 input)⇒ 此前点格子只冒出输入框、不能直接打字；现点开格后 `nextTick` 手动
  `focus()` + `select()`，并把 `.dp-plan/.dp-out-fill` 撑满单元格(整格点击热区)。

## 迁移执行(两账套)

```text
[新增] migrate-route-process-control-optional-20261119.sql
  [print] [待改] HSDZ_MES:ROUTE/工序控制 required=1 共 1 行
  [print] [OK] HSDZ_MES:工序控制已改为非必填
  [print] [CHECK-OK] HSDZ_MES:ROUTE/工序控制 非必填(required=0)
  === 同步完成: 执行 1, 跳过 839, 失败 0 ===

[新增] migrate-route-process-control-optional-20261119.sql
  [print] [待改] HSDZ_MES_TEST:ROUTE/工序控制 required=1 共 1 行
  [print] [OK] HSDZ_MES_TEST:工序控制已改为非必填
  [print] [CHECK-OK] HSDZ_MES_TEST:ROUTE/工序控制 非必填(required=0)
  === 同步完成: 执行 1, 跳过 839, 失败 0 ===
```

界面复核：`工艺路线 → 更多 → 表格调整` 中「工序控制」已无「必填」角标
(见 `工艺路线-工序控制非必填.png`；工序编码/工序序列仍必填)。

## 验证证据(ego browser，源码版 5173)

| 证据 | 说明 |
|---|---|
| `排单计划-列顺序.png` | 用 `schedPlanSheetHtml` 生成的纸表：`…成型车间 / 订单数量 / 生产计划数量 / 工序未报工量 / 实际完成数量 / 成型交期…` |
| `工单排产-未完成数量框.png` | 右下角蓝框：左侧勾 `1号车间`+`3号车间` ⇒ scope `1号车间、3号车间`、合计 `6715 件`；不勾时显示当前线 `1号车间 6000 件` |
| `报工记录-勾选行导出.png` | 报工记录勾选 2 行 → 导出报表弹窗显示「只导出当前勾选的 2 行」 |
| `工艺路线-工序控制非必填.png` | 表格调整里工序控制无必填标记 |
| `ego/round-36-click-focus.mjs` | 工单排产真实鼠标点击日期格 → 输入框聚焦 → 键盘输入替换原值 → Esc 取消 |
| `ego/round-37-plan-sheet.mjs` / `gen-plan-sheet.mjs` | 生成并截图排单计划 HTML |
| `ego/round-38-report-export.mjs` | 报工记录勾选行 + 导出弹窗 |
| `ego/round-39-unfinished-box.mjs` | 旧版(按类型勾选)取证；2026-11-20 修正后以 `ego/round-51-line-checkboxes.mjs` 为准 |
| `ego/round-51-line-checkboxes.mjs` | 不勾=当前线 `1号车间 6000`；勾 1号+3号 ⇒ `6715`；勾选不切换右侧明细 |
| `ego/round-41-route-dialog.mjs` | 打开工艺路线表格调整并截图 |

导出内容另做了字节级复核：勾 2 行导出的 xlsx 解析后 = 标题 + 公司抬头 + 表头 13 列 + **2 行数据**；
勾 N 行只出现 N 行。

## 测试

```text
cd frontend
node --test src/core/views/reportListExport.test.js \
            src/views/modules/plan/workOrderBoardUnfinished.test.js \
            src/business/print-formats.test.js
# 48 tests / 48 pass

npm test   # 2292 tests / 2286 pass
# 6 fail 全部是 recordSheetConfigs.livedb.test.js 的活库直查:
# spawnSync ... SQLCMD.EXE ENOENT(本机未装 sqlcmd),与本任务改动无关
```

`npm run build` 通过。
