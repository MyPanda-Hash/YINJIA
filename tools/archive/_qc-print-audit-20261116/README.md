# 其它制程检验单「打印不全」修复(2026-11-16)

| 属性 | 内容 |
|---|---|
| 用户口径 | ①「帮我确认一下其他制程检验中的检验单的打印,看下当前的报表实现是否也存在上述问题」;②「主要是修复打印不全的问题,其他不做修改」「组件使用原来的吧」 |
| 范围 | 首件检验单(QC_FIRST_INSP)/ 出货检验单功能(QC_PROC_INSP)/ 出货检验表观(QC_ASM_INSP)/ 巡线检验(QC_LINE_PATROL);出厂检验报告(QC_OQC_REPORT)预览/导出走服务端 PDF,不在本次范围 |
| 原则 | **纸面组件一行不改**;只改 `PanelxList.vue` 的「打印 / 打印预览 / 导出 PDF」通道 |

## 一、核对到的现状(取证)

### 1. 「导出 → 打印预览」走的是截图通道(固定 A4 竖版 194mm)

| 单据 | 实测现象 |
|---|---|
| 首件检验单 | 纸面 980px 宽,整张缩进 A4 竖版(字约 5.6pt),与原生打印(横版、满宽)不一致 |
| 出货检验单功能 / 出货检验表观 | 纸面宽度弹性(窄窗仅 313px)+ 内层 `.qr-grid-scroll` 横向滚动 ⇒ 截图**只有左半边,右侧列缺失(打印不全)**,还带滚动条、「暂无检验项…」占位、下拉「请…」+箭头 |
| 巡线检验 | 纸面 900px 宽(12 列),同样被缩进 A4 竖版 |

证据:`shots/QC_PROC_INSP-printpreview.jpg` / `QC_FIRST_INSP-printpreview.jpg` / `QC_LINE_PATROL-printpreview.jpg`。

### 2. 原生打印方向靠全局 `@page` 顺序(碰运气)

`PanelxList` 静态引入全部纸面组件,构建后 `QcLinePatrolSheet` 的 `@page{size:A4 landscape}` 排在
`QcProcInspSheet` / `QcOqcSheet` 的 portrait 之后 ⇒ 出货检验单声明了竖版却会被带成横版(实测
`Page.printToPDF`:修复前出货检验单 PDF 页面是 297×210mm)。

## 二、修复(全部在 `frontend/src/core/views/PanelxList.vue`)

1. **「打印预览」改为复用原组件的原生打印**:
   `previewSheetPdf()` 对 `.ic-sheet / .fi-sheet / .lp-sheet / .qr-sheet` 直接调 `printApprovalSheet()`
   (与侧栏「打印」同一条路:组件原样渲染 + 各自 `@media print`),不再走「截图 → A4 竖版」。
   ⇒ 打印件与屏幕纸面一致、完整、矢量;多页签/分组面板仍走原截图打印层。
2. **原生打印按纸种注入 `@page`**(`printApprovalSheet`):
   - `.fi-sheet`(首件)/ `.lp-sheet`(巡线)⇒ `A4 landscape`;
   - `.qr-sheet`(出货检验)/ `.ic-sheet`(委托单)⇒ `A4 portrait`;
   不再依赖全局规则顺序。
3. **出货检验单「导出 PDF」按 A4 纸宽重排**:`snapSheetPage` 对 `.qr-sheet` 强制以 A4 内容宽(733px)
   重排克隆体,并用新增的 `prepareQrSheetSnapshot()` 撑开 `.qr-grid-scroll`、表格 `min-width:0 /
   width:100% / table-layout:fixed`、摘 `.no-print` 控件、清占位提示 ⇒ 右侧列不再缺失。

回归测试:`frontend/src/core/views/qcSheetPrintFix.test.js`(3 条,钉住上述三处)。

## 三、修复后验证(本机 8090,jar SHA256 `8CB79066…`)

| 单据 | 打印预览 | `@page` 注入 | 导出 PDF |
|---|---|---|---|
| 出货检验单功能 | 原生打印 `printCalled=1`、无截图打印层 | `A4 portrait` | 1 页 A4 竖版,**全列完整**(见 `after-QC_PROC_INSP-export.png`) |
| 首件检验单 | 原生打印、无截图打印层 | `A4 landscape` | 1 页 A4 横版,完整(与修复前一致) |
| 巡线检验 | 原生打印、无截图打印层 | `A4 landscape` | (导出通道未改,原样) |

证据:
- `after-QC_PROC_INSP-native.png` / `after-QC_PROC_INSP-export.png`(修复后:满宽、全列、无滚动条/占位)
- `after-QC_FIRST_INSP-native.png` / `after-QC_FIRST_INSP-export.png`(横版满宽)
- `after-QC_LINE_PATROL-native.png`(横版)
- `QC_PROC_INSP-native3.pdf` / `QC_FIRST_INSP-native3.pdf` / `QC_LINE_PATROL-native4.pdf`(原生打印页方向与内容)
- `QC_PROC_INSP-export3.pdf` / `QC_FIRST_INSP-export3.pdf`(导出 PDF)

其它:
- 前端测试:新增用例 3/3 通过;全量 `npm test` 1945 pass / 8 fail(均为存量红:需库口令的 livedb 5 条 + 旧打印断言 3 条,与本次无关)。
- 取证全部为**只读查看正式库单据**,未保存任何数据;测试账套无新增数据。
- 生产服务器(36.140.66.163)未部署;上线走 `deploy/deploy-production.bat` 增量 + 换 jar 并记部署台账。

## 四、本次未动(按「其他不做修改」)

- 首件检验单**草稿态**原生打印仍会带出「密级 / 使用范围」下拉箭头(组件打印规则没清控件外观,已审核单为文字态不出现);
- 出厂检验报告原生打印方向(全局 `@page` 顺序问题)未改;其「打印预览 / 导出 PDF」走服务端 Jasper PDF,不受本次问题影响;
- 纸面组件(QcFirstInspSheet / QcProcInspSheet / QcLinePatrolSheet / QcOqcSheet)一行未改。
