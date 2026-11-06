# 成型车间排单计划 · 勾选打印(2026-11-03)

用户口径：「**修改打印的形式不是点击排单计划把目前生产线的所有单据打印，而是选择勾选几个打印几个的形式**」。

方案与口径见 `docs/plans/2026-10-31-成型车间排单计划-报表.md` **§9**。

## 改了什么

| 文件 | 改动 |
|---|---|
| `frontend/src/views/modules/plan/WorkOrderBoard.vue` | 「排单计划」按钮跟随**勾选行**：`disabled = !checkedSched.length`、文案带张数「排单计划（N）」；`printPlanSheet()` 出纸前按勾选行 `行id` 过滤（接口与后端零改动） |
| `frontend/src/i18n/locales/en.js` | tooltip 改为「勾选工单后打印排单计划,只打印勾选的工单」；新增「请先勾选要打印的工单」；删掉旧的「未选线=全部产线」死词条 |

## 文件

| 文件 | 用途 |
|---|---|
| `probe.mjs` | 只读取证：`/px/scheduleBoard/planSheet` 的行结构（每行都带 `行id`，勾选过滤才有锚点） |
| `verify-select-print.mjs` | **页面链路验证**（CDP + 5173 源码实例）：未勾选按钮置灰 → 勾 2 行 → 点按钮 → 读页面内打印层行数/单据编号/标题 |
| `render-selected-sheet.mjs` | 把「勾选后」实际会打的 HTML 按 A4 横向渲染成图片（与出纸同一函数，肉眼验版式） |
| `shot-select-print.png` | 页面态截图（打印层是 `left:-10000px` 的离屏层，截不到；行数由 DOM 断言） |
| `sheet-selected.png` | 勾选 2 张后的纸面版式 |

## 跑法

```bash
cd tools/archive/_plan-sheet-select-20261103

# 1) 只读取证(8090 或 5173 都行,后端同一台)
node probe.mjs http://127.0.0.1:8090

# 2) 页面链路验证(对着 vite 5173 = 源码即时生效)
node verify-select-print.mjs http://localhost:5173

# 3) 纸面版式(勾选 2 张)
node render-selected-sheet.mjs http://127.0.0.1:8090 sheet-selected.png 2号车间 GD-2026-10-0227,GD-2026-10-0228
```

## 实测(2026-11-03,对口 5173)

`node verify-select-print.mjs` **6/6 PASS**,跑了两种勾选:

| 检查 | 勾 2 张 | 勾 4 张(= 表头全选,整线) |
|---|---|---|
| 2号车间未完工行 | 4 行（`GD-2026-10-0227/0228/0229`、`GD-2026-11-0008`） | 同左 |
| 未勾选时按钮 | `disabled=true`，文案「排单计划（0）」⇒ 不会再「一点就整线全打」 | 同左 |
| 勾选后按钮 | `disabled=false`，文案「排单计划（2）」 | 「排单计划（4）」 |
| `window.print` 调用次数 | 1 | 1 |
| 打印层行数 | **2**（= 勾选张数） | **4**（全选 = 整条产线，旧能力保留） |
| 打印层单据编号 | `GD-2026-10-0227, GD-2026-10-0228` | 4 张全对 |
| 标题 | 仍为「成型车间排单计划」 | 同左 |

其他：`node --test src/business/print-formats.test.js` **13/13**（新增 `pickPlanSheetRows` 单测：只留勾选行/
保持页面顺序/没勾选=空/字符串 id 也认/勾选行已不在返回=空）；`npm run build` **通过**。
`node --test`（全量 1432+1 条）里 5 条 `recordSheetConfigs.livedb.test.js` 失败 = **环境问题**
（`spawnSync SQLCMD.EXE ENOENT`，与本改动无关）。
