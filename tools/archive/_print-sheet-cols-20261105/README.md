# _print-sheet-cols-20261105 — 《成型生产任务单》单据编号列不再折行

用户 2026-11-05(对着手机扫码多码选择框)反馈:

> 「码和信息很难对应是哪一条的」

根因有一半在**纸面**:`printWorkTaskSheet` 里 `td{word-break:break-all}` + 等分列宽,把
`GD-2026-11-0018` 折成 `GD-2026-11-001 / 8`,而扫码列表里显示的是完整单号 —— 两边对不上眼。

## 改法(frontend/src/business/print-formats.js)

- 加 `<colgroup>`:**成型 10 列** = 4/14/8/9/17/11/7/8/9/13 %;**切炭/组装 9 列** = 4/15/9/10/19/12/8/9/14 %;
- 「单据编号」单元格加 `class="no"` → `white-space:nowrap`,14% ≈ 39mm(横向 A4),
  11px 字号放得下完整 `GD-2026-11-0018`;
- 二维码列 13% ≈ 36mm,`img` 仍 64px,不挤。

## 验收

`render-task-sheet.mjs` 用与单测同一套 mock 渲染出真实打印 HTML(`task-sheet.html`),
浏览器打开截图 `task-sheet-cols.png`:

- 三行单据编号**都是一行**(`GD-2026-11-0018` / `-0017` / `-0016`),单元格高度一致;
- 列宽固定后不再随内容跳动。

复现:`node tools/archive/_print-sheet-cols-20261105/render-task-sheet.mjs` → 打开同目录 `task-sheet.html`。
