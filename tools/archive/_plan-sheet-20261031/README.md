# 成型车间排单计划 · 取证与复核（2026-10-31）

用户甩来手填纸表照片《成型车间排单计划》，要求「打出这样的报表形式，就在当前工单排产处实现，
这样就不需要根据那个产线进行处理了」。方案与字段映射见
`docs/plans/2026-10-31-成型车间排单计划-报表.md`。

## 文件

| 文件 | 用途 |
|---|---|
| `render-sheet.mjs` | 取 `/px/scheduleBoard/planSheet` → 调前端**同一个** `schedPlanSheetHtml` → 按 A4 横向渲染成 `sheet.png`（看版式；与真正出纸内容一致） |
| `shot-print-layer.mjs` | 页面链路验证：把 `window.print` 打桩 → 点「排单计划」→ 读打印层 DOM（行数/表头/标题）+ 截图 |
| `Q.java` | 只读查库小工具（核对 dm_kh 的客户等级字段、plang 的物料/型号/产线） |

## 跑法（8090 起来之后）

```bash
cd tools/archive/_plan-sheet-20261031
node render-sheet.mjs http://127.0.0.1:8090 sheet.png        # 见版式
node shot-print-layer.mjs http://127.0.0.1:8090              # 见按钮链路
```

## 实测（2026-10-31）

- `planSheet` 返回 7 行，混排 `1号机 / 7号机 / 2号车间` ⇒ 确实**不分产线**；
- 表头 20 列 = 纸表 13 列 + 日期列 7 天（10月31日 … 11月6日）；
- 点按钮后 `window.print` 调 1 次、`document.title = 成型车间排单计划`；
- 单测 `print-formats.test.js` 12/12（新增 3 条）。
