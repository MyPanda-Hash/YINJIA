# _plan-sheet-layout-20261105 —— 排单计划纸表版式重排 取证(任务产物,只读)

用户口径 2026-11-05:「当前这个报表已经调整不需要实现那么多天数,可以调整一下当前的这个表格和设计,
不需要那么窄,看着很丑」。

## render.mjs —— 用**真数据**把纸表渲染成图对比改版前后

- 取数:直接用用户截图(2026-11-05 11:xx)里的那三行真数据(广州佳贝尔 / 广东一米 / 青岛伊可普,
  GD-2026-10-0227/0228/0229,2号车间),字段与 `/px/scheduleBoard/planSheet` 返回同构;
- 渲染:调前端导出的**纯函数** `schedPlanSheetHtml`(与真正出纸的 HTML 完全一致),写临时 html;
- 截图:无头 Edge + CDP,`Emulation.setDeviceMetricsOverride 1123×900 @2x`(A4 横向 96dpi)。

用法:

```bash
cd tools/archive/_plan-sheet-layout-20261105
node render.mjs <out.png> <days>     # days=日期列个数(1~10),默认 3
```

## 产物(改版前后对比)

| 文件 | 说明 |
|---|---|
| `baseline-3days.png` | **改版前**(2026-11-05 之前):日期列 7.67%、正文 9.5px、长表头被浏览器挤成「生产计划数/量」 |
| `after-3days.png` | 改版后 3 天(默认):日期列 6%、客户名称/单据编号 10.49%、正文 10.5px、表头显式换行 |
| `after-4days.png` | 改版后 4 天 |
| `after-10days.png` | 改版后 10 天(上限,compact 降字号 9/8px、日期表头 M/D) |

版式口径与单测见 `docs/plans/2026-10-31-成型车间排单计划-报表.md` §13 与
`frontend/src/business/print-formats.test.js`(22/22 PASS)。
