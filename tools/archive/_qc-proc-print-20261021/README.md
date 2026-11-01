# 检验单：打印 / 打印预览与单据一致（2026-10-21）

用户口径：「打印处的格式应该和当前单据对应，修改当前打印预览的渲染方式，
第一张图为打印预览的格式，第二张为原来的系统内实现的报表。」

设计与改法见 **`docs/design/检验单-打印与预览一致.md`**。

## 两个病根（都已修）

1. **制程检验单打印是空白页**：公共打印样式把 `.portal` 整体 `visibility:hidden`，
   再逐个 whitelist 纸张根类名，**漏了 `.qr-sheet`**。实测出纸 1.9KB / 3 页空白
   （首件 `.fi-sheet` 在白名单里 → 379KB 正常）。
2. **打印预览是另一份版式**：「导出报表 → 打印预览 / 导出 PDF」走服务端 `.jrxml`，
   与面板纸张表各改各的，同一张单纸上一个样、屏上另一个样。

## 复跑

```bash
# 出纸实测（print 媒体 + Page.printToPDF，断言非空白）
node tools/archive/_qc-proc-print-20261021/_probe-qc-proc-print.mjs http://localhost:5173

# 三处一致性（拦网络请求：打印预览不该再打 /api/report/export）
node tools/archive/_qc-proc-print-20261021/_probe-qc-print-preview.mjs http://127.0.0.1:8090

# 回归：别的面板仍走服务端报表
node tools/archive/_qc-proc-print-20261021/_probe-other-panels.mjs

# 打印态截图（核对版式）
node tools/archive/_qc-proc-print-20261021/_shot-printmedia.mjs
```

## 实测结论

| 项 | 结果 |
|---|---|
| `_probe-qc-proc-print.mjs` | 10/10 PASS（制程 1.9KB/3页空白 → **236KB/1页**；首件 379KB 正常） |
| `_probe-qc-print-preview.mjs` | 12/12 PASS（打印预览零次 `/api/report/export`，产出 blob） |
| `_probe-other-panels.mjs` | 3/3 PASS（销售订单仍走服务端报表，未被误伤） |
| 前端单测 / 构建 | 858 例 853 过（5 例既有活库环境项）/ 构建通过 |

## 脚本清单

| 文件 | 用途 |
|---|---|
| `_probe-qc-proc-print.mjs` | 出纸实测：print 媒体下纸张可见性 + `Page.printToPDF` 字节数/页数 |
| `_probe-qc-print-preview.mjs` | 打印 / 打印预览 / 导出 PDF 是否同一版式（拦 `/api/report/export` 证明不再走 jrxml） |
| `_probe-other-panels.mjs` | 回归：销售订单 / 送料暂收单仍走服务端报表 |
| `_shot-printmedia.mjs` | print 媒体下截图 + **打印列宽实测**（列宽塌成 0 就是「一字一行」的病根） |
| `_shot-first-printmedia.mjs` | 首件检验单 print 媒体截图 |
| `_diag-print2.mjs` | 取证：print 媒体下整条父链 computed visibility / display（病根①靠它定位） |
| `_diag-buttons.mjs` | 取证：侧栏与「导出报表」弹窗实际有哪些入口 |
| `_inspect.mjs` | 看服务端 `.jrxml` 出纸的 PDF 结构（页数 / MediaBox） |
| `print-*.pdf` / `printmedia-*.png` | 出纸与截图产物（**按 .gitignore 不入库**，跑上面的探针/截图脚本本地重新生成即可比对版式） |
