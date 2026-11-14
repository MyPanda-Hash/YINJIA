# 工序流转明细展开区删除（2026-11-14）

## 一、用户口径（原话）

> 「删除掉这个工序流转明细，这个作用不明显还很丑，除非有其他方法」

截图给的是**工单排产**（`/prod/plan/workOrderBoard`，生产 3 号机）那一行展开的「工序流转明细」大表。

## 二、判断与做法

原展开区是 2026-11-12「方案 A」加的一列 `type="expand"`，展开后 8 列
（工序/换算率/计划量/可加工量/已审完工/待报量/待流入量/状态）。**作用不明显 + 版面丑**的根因：

1. 行内本来就有工序口径八列（当前工序 / 当前工序计划量 / 当前工序完工量 / 上道工序 / 上道完工量 /
   可加工量 / 待报量 / 待流入量）—— 展开表把同一批数字再说一遍；
2. 展开表横跨整行、灰底铺满，一屏几十行的排产表里点开一次就把视线全抢走；
3. 全工序进度本来就有主场：「生产工序进度看板」的环 / 圆点链（`WoProgressRing` / `WoProgressChain`）。

⇒ **展开区整列删除**（工单排产 + 生产工单两页同一块一并删），同样的数字用「其他方法」保留：
**「当前工序」格的悬停提示**（`business/woFlowChain.js`），一行一道工序，平时看不见、要看鼠标停一下；
`▶` = 当前工序，`★` = 从生产工序进度看板深链定位过来的那道工序。

保留项：深链定位的**行高亮 + 「已定位：工单号#行号 · 工序」提示**（契约 §3.1 的其余部分照旧）。

## 三、改动文件

| 文件 | 改动 |
|---|---|
| [`frontend/src/views/modules/plan/WorkOrderBoard.vue`](../../../frontend/src/views/modules/plan/WorkOrderBoard.vue) | 删 `type="expand"` 列（30px）+ `.wb-flow-box/.wb-flow-title/.wb-flow-tbl` 全套 CSS；去掉 `expandedKeys` / `onExpandChange` / `isFocusFlow`；`当前工序` 格加 `:title="flowTip(row)"`；深链 ③ 改「只高亮不展开」，`focusOp` 改为只在提示里标 ★ |
| [`frontend/src/views/modules/plan/WorkOrderList.vue`](../../../frontend/src/views/modules/plan/WorkOrderList.vue) | 删 `type="expand"` 列（34px）+ `.wol-flow-*` CSS；`当前工序` 格加 `:title="flowTip(row)"`（列设置里的锁定列说明同步去掉 expand） |
| [`frontend/src/business/woFlowChain.js`](../../../frontend/src/business/woFlowChain.js)（新增） | 纯函数 `flowChainTip(steps,{t,fmt,focusOp})`：逐道工序拼多行提示文本（当前工序 ▶、定位工序 ★、待流入量 0 不占位、没工序台账返回空串 ⇒ 不弹空提示） |
| [`frontend/src/business/woFlowChain.test.js`](../../../frontend/src/business/woFlowChain.test.js)（新增） | 4 条单测（本机 `node src/business/woFlowChain.test.js`，4/4 pass） |
| `tools/archive/_wo-progress-click-20261113/CONTRACT.md`、`README.md` | 补 2026-11-14 变更注记（§3.1③「自动展开」作废，其余不变） |

后端零改动：`ProcessFlow` 照旧返回 `工序流转明细[]`（提示文本就是读它，别删）。

## 四、验证（ego-browser，5173 源码版）

脚本 [`round-01.mjs`](round-01.mjs)，运行：

```
ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/wo-flow-expand-remove-20261114/round-01.mjs')"
```

结果 9/9 PASS（DOM 取证，不靠肉眼）：

| 判据 | 结果 |
|---|---|
| 工单排产：`.el-table__expand-icon` / `.el-table__expand-column` = 0 | ✅ |
| 工单排产：`.wb-flow-tbl` / `.wb-flow-box` = 0 | ✅ |
| 工单排产：`当前工序` 格有 title（`▶ 成型 · 计划量 25 · 已审完工 10 · 可加工量 25` + 下一道 `装箱 … 待流入量 30`） | ✅ |
| 生产工单：expand 列 0、旧展开表 0、`当前工序` 格 title 有值（22 行里 6 行有工序台账） | ✅ |
| 深链 `?line=3号机&wo=GD-2026-11-0021&op=成型`：`.wb-focus-tip` = 「已定位：GD-2026-11-0021#1 · 成型」、高亮行 1 行、提示里 `★ 成型 …`、地址栏 query 已摘 | ✅ |

截图：[`round-01-board.png`](round-01-board.png)（工单排产，无展开箭头）、
[`round-02-deeplink.png`](round-02-deeplink.png)（深链定位）、
[`round-03-list.png`](round-03-list.png)（生产工单，无展开箭头）。

补充一轮 [`round-02-wide.mjs`](round-02-wide.mjs)（同 task space 的 p1 页，换 2号车间 这条有 3 行的线,
并把「生产工单」也再核一遍）—— 仍是 0/0/0:

```
工单排产 2号车间 → {"line":"生产线：2号车间","rows":3,"expandIcons":0,"expandColumns":0,"flowTables":0}
生产工单 → {"rows":22,"expandIcons":0,"expandColumns":0,"flowTables":0,
            "curOpTitle":"▶ 成型 · 计划量 100 · 已审完工 0 · 可加工量 100\n切炭 …\n组装 …"}
```

截图:[`round-04-board-wide.png`](round-04-board-wide.png)、[`round-05-list-wide.png`](round-05-list-wide.png)。
(ego 窗口在本机固定 871×596,`Emulation.setDeviceMetricsOverride` 被 ego 拒(task.cdp 只放行 Target./Browser.),
所以截图的横向视野有限 —— 判决以 DOM 计数为准。)

构建：`frontend && npm run build` 通过（36.7s）。

## 五、未做（等用户点头）

- `backend/src/main/resources/static` 未同步、8090 的 jar 未换 ⇒ **8090 仍是旧前端**，看效果走 5173。
- 未提交（本仓默认不自行 commit，等用户明确说「提交」）。
