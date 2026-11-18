# 订单结转 / 生产工单 / 工单排产 / 快速排产:点整行即勾选(2026-11-17)

## 用户口径

> 「修改当前订单结转,生产工单,工单排产,快速排产中的勾选实现,不需要只选择一定要点那个小方框,
> 而是可以点击这一行来选择」

## 改了什么

| 页面 | 文件 | 改动 |
|---|---|---|
| 订单结转 | `frontend/src/views/modules/plan/OrderConvert.vue` | 表格加 `@row-click="onRowClick"` |
| 生产工单 | `frontend/src/views/modules/plan/WorkOrderList.vue` | 同上;额外放过 `.dp-plan`(行内日排产格) |
| 工单排产 | `frontend/src/views/modules/plan/WorkOrderBoard.vue` | 同上;额外放过 `.dp-plan` |
| 快速排产 | `frontend/src/views/modules/plan/ScheduleBoard.vue` | ① 待排产池 + ② 已排产两张表都加;顺带补 `todayTable` 的 `ref` 声明 |
| 公共判据 | `frontend/src/business/rowSelect.js`(新) | `isRowToggleClick` / `toggleRowOnRowClick` |
| 单测 | `frontend/src/business/rowSelect.test.js`(新) | 12 条(`node --test`,全绿) |

**为什么不是"所有点击都翻勾选"**:这四张表里有格内可操作控件 —— 交货日期选择器、本次转单数量输入框、
行内日排产格(点它是就地改当天计划数量)、工单号链接(点它进「工单详情·追溯」)。点这些地方的目的
不是选行,顺手翻一次勾选会让人莫名其妙(把已勾的行取消了,后面点「转工单/排产」就少一行)。
所以统一先看 `event.target` 的祖先链,命中控件就**不动勾选**;点复选框自己那一下也不重复处理
(那下 el-checkbox 已经翻过,再翻就是"点了没反应" —— 2026-11-13 在 ProductImportDialog /
RecordSheetPanels / RefPickDialog 上已经踩过同一个坑)。

翻转走 el-table 自己的 `toggleRowSelection`(订单结转 / 生产工单 / 快速排产① 都开了
`reserve-selection` 跨页保留勾选,自己另存数组会跟表格内部状态打架)。

顺带修掉一个存量 bug:`ScheduleBoard.vue` 里 `onTodayFilter()` 一直在调用
`todayTable.value?.clearSelection?.()`,但 `todayTable` **从未声明** ⇒ 改筛选/清空筛选一按就
`ReferenceError: todayTable is not defined`。本次补上了 `const todayTable = ref(null)`。

## 验证(ego 浏览器,5173 源码版,登录工厂 = YJ_TEST)

全部用 `ego-browser nodejs` 跑本目录下的 `round-NN.mjs`,脚本可复跑。

| 轮次 | 验的事 | 结果 |
|---|---|---|
| round-01 | 四页能否打开、有没有行 | 订单结转当天空(需跳"最近有数据的一天")、生产工单 21 行、工单排产需先选产线、快速排产①18 行 |
| round-02 | ①订单结转 ②生产工单 ④快速排产①:点普通格 / 再点 / 点复选框 | 三页都:点一次 `checkedRows 0→1`(按钮计数同步 `转工单(0)→(1)`、`选择工艺路线(1)`),再点回 0;点复选框只翻一次 |
| round-03 | ③工单排产(先选线)、④快速排产②已排产(切"全部"后 15 行) | 点行 `checkedRows 0→1`,按钮 `取消结案/打印工单/调拨/排单计划`、`撤销排产` 计数同步;再点回 0;复选框自身只翻一次 |
| round-04/05/06 | 反向验证尝试 | ⚠ 用**坐标**点 `.dp-plan` 会打偏:那些日期格被右侧 sticky 冻结列盖住,`elementFromPoint` 拿到的是**别的行**的格子(所以看起来"翻了勾选",实际点的是别人的单元格)。教训见 round-05 的打点输出 |
| round-07~09 | 改用"在元素上派发一次冒泡 click"(等于人点了这个元素) | 生产工单 `.dp-plan` ⇒ **不翻勾选**且就地编辑框出现;`.el-link`(工单号)⇒ **不翻勾选**、追溯弹窗照开;工单排产 `.dp-plan` ⇒ 同上 |
| round-10/11 | 订单结转(格内控件最多):普通格 / 本次转单数量输入框 / 交货日期输入框 | 普通格 ⇒ `转工单(0)→(1)`;点数量输入框、点交货日期输入框 ⇒ `checkedRows` 保持 1(**不翻**);再点普通格 ⇒ 回到 (0) |
| round-12 | 收尾:关闭本任务的 ego 任务空间 | `空间已关闭`(截图已在落盘目录里) |
| round-13 | **提交后终态冒烟**(源码 CRLF→LF 归一之后,重开空间登 5173) | 生产工单 23 行:`checkedRows 0→1`;快速排产① 19 行:`0→1` ⇒ 最终代码仍然"点行即勾选" |

截图:`订单结转-勾选.png`、`生产工单-勾选.png`、`工单排产-勾选.png`、`快速排产-待排产-勾选.png`、
`快速排产-已排产-勾选.png`、`生产工单-日排产格不翻勾选.png`、`生产工单-工单号链接不翻勾选.png`、
`工单排产-日排产格不翻勾选.png`、`订单结转-格内控件不翻勾选.png`。

## 另外两道闸

- `cd frontend && npm run build` ⇒ `✓ built in 27.98s`(无报错);
- `cd frontend && npm test` ⇒ 2014 条里 **2009 通过 / 5 失败**,5 条全部是
  `recordSheetConfigs.livedb.test.js` 的活库直查(`spawnSync ... SQLCMD.EXE ENOENT`,
  本机没装 sqlcmd / 没配口令),与本次改动无关,改动前即如此。
