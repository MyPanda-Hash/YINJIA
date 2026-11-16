# 检验委托单打印修版(2026-11-16)

| 属性 | 内容 |
|---|---|
| 需求(用户 2026-11-16 报障,含两张截图) | ①「打印的格式存在问题,字的格式会挤压,帮我修复这个打印格式的问题」;②「按钮实现不应该被打印出来」(红框圈住纸面上的「选择检验项目」按钮)。 |
| 设计真源 | [docs/design/检验委托单-首版.md](../../../docs/design/检验委托单-首版.md) §4.1 / §八.9 |
| 影响面 | 只有检验委托单(INSP_COMMISSION)纸面;其它面板 / 其它纸面打印路径不变 |

## 根因(实测复现,有证据)

同一条纸面有**两条打印路径**,用户截到的第二张图是「导出 → 打印预览」那条:

1. **侧栏「打印」** = `window.print()` + `@media print` —— 本来是正确的(矢量、A4 竖版、控件已隐藏)。
2. **「导出 → 打印预览 / 导出 PDF」** = `openSheetPrint` → 离屏克隆 → **截图**(`modern-screenshot`)→
   图片按 194mm 摆进 A4 页。`@media print` 对截图**不生效**,于是:
   - 屏幕编辑态原样被拍进去:**「选择检验项目」按钮、日期控件、输入框占位提示**都印在纸上
     (`before-printpreview-image.png` 就是从 8090 打印层里取出的那张图);
   - 更关键的是 **modern-screenshot 的 SVG `<foreignObject>` 对中文衬线字体光栅化异常**:
     纸面是宋体(`font-family: SimSun`),排版按宋体、foreignObject 出图却按默认 sans 度量渲染
     ⇒ 行宽不一致 → **文字换行错位、行与行叠在一起**(`before-export-overlap.pdf` / `-page1.png`)。
     实测:SimSun / NSimSun / `serif` 全部重叠;仿宋(FangSong)、微软雅黑正常
     (`shots/font-simsun.png` vs `shots/font2-fangsong.png`、`shots/variant-yahei.png`)。
     受控表单不应该为了渲染器换字体,故**换渲染器**。

## 修复

| 文件 | 改动 |
|---|---|
| `frontend/src/core/qc/InspCommissionSheet.vue` | ①「选择检验项目」按钮加 `no-print`;② `@media print` 里补一份**不依赖 `body.approval-printing`** 的裸规则:`.ic-sheet .ic-pick-btn / .ic-items-op / .no-print / .ic-date-pick` 隐藏、日期回退「年 月 日」文字、占位提示透明 ⇒ Ctrl+P / 打印 / 预览任何路径都不出控件;③ 印刷态行距显式 `line-height:1.5`(明细小表 1.45),避免密排贴行 |
| `frontend/src/core/views/PanelxList.vue` | ① `previewSheetPdf()`:判到 `.ic-sheet` 就改走 `printApprovalSheet()`(**与侧栏「打印」同一条原生打印通道**,矢量、与纸样同字体、A4 竖版 1 页);② 新增 `snapInspSheetPage()`:ic-sheet 的**导出 PDF 截图改走 html2canvas**(按页面实测文本排版,宋体正常),`onclone` 里用 `prepareInspSheetSnapshot()` 摘掉按钮/日期控件/删行/占位提示;③ 其它纸面仍走原 `snapSheetPage` + modern-screenshot 统一通道 |
| `frontend/src/core/views/inspSheetPrint.test.js` | 新增回归测试(5 条):按钮 no-print + 裸 @media print 规则、行距、ic-sheet 走 html2canvas/不压 A4 重排、打印预览复用 printApprovalSheet、截图不改纸张字体 |

## 验证证据

| 文件 | 说明 |
|---|---|
| `before-printpreview-image.png` | **修复前**「导出→打印预览」打印层里的截图:带「选择检验项目」按钮 + 日期控件 + 占位提示(用户截图 2 的同款现场) |
| `before-export-overlap.pdf` / `-page1.png` | **修复前**导出 PDF:文字换行错位、行行重叠(用户说的"挤压") |
| `after-native-print.pdf` / `-page1.png` | **修复后**「打印 / 打印预览」原生通道输出:1 页 A4 竖版、无按钮/日期控件/占位、文字清晰无重叠 |
| `after-export-5173.pdf` / `-page1.png` | **修复后** 5173 源码版「导出 PDF」(html2canvas):有值渲染、无控件、宋体、无重叠 |
| `after-export-8090.pdf` / `-page1.png` | **修复后** 8090 打包版(重建 jar 后)「导出 PDF」:同上(正式账套只读打开 WT-2026-11-0001 取证,未保存任何数据) |
| `shots/screen-8090.png` | 8090 页面实况(纸面本身显示正常) |
| `shots/h2c.png` / `h2c-filled.png` | html2canvas 单测:空表 / 填值(输入框值能画出来)都正常 |
| `shots/font-simsun.png` / `font2-fangsong.png` / `variant-yahei.png` | 字体对照:modern-screenshot 下 SimSun 重叠、仿宋/雅黑正常(解释为什么换渲染器而不是换字体) |
| `ui/round-*.mjs` | ego 浏览器取证脚本(含 8090 打包版复核 round-33) |

### 验证结论

- 5173(源码,测试账套)与 8090(重建 jar 后,正式账套只读)两处:
  - 「导出→打印预览」`printCalled=1`、**没有** `#yj-print-host` 打印层、`body.approval-printing` + `@page A4 portrait` 生效 ⇒ 走的是原生矢量打印;
  - 「导出 PDF」1 页 A4 竖版,无按钮/日期控件/占位提示,文字不重叠;
  - 打印态量到 `.ic-pick-btn` display=none,`.ic-grid td` line-height 16.5px(1.5)。
- 前端单测:新增 `inspSheetPrint.test.js` 5/5 通过;全量 `npm test` 1942 pass / 8 fail,8 条均为存量红
  (`recordSheetConfigs.livedb` 需库口令 5 条 + `sheetPdfA4`/`sheetPdfFillA4` 旧断言 3 条,与本次改动无关)。
- 本机 8090 已重建:`backend/target/app.jar` SHA256 `57828427…`(重建后 `DbSync` 执行 0 条,无库变更)。

## 备注

- 测试账套联调用草稿 `WT-2026-11-0005`(含值)已物理删除;正式账套只有既有 `WT-2026-11-0001` 草稿(未动)。
- **生产服务器(36.140.66.163)未部署**——本次只改了本地代码/静态产物;上线走 `deploy/deploy-production.bat`(增量 + 换 jar),并按 `deploy/部署台账.md` 记账。
- 以后若再给 ic-sheet 加编辑控件,记得同时加 `no-print` 类或补进 `prepareInspSheetSnapshot` 的清理名单,
  否则截图路径(导出 PDF)会把它拍上纸。
