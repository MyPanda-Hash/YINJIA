# 生产领料单 PDF(GD-2026-11-0009#1 · 组装 + 混料)

> 2026-11-17 用户口径:「把工单 GD-2026-11-0009#1 的生产领料单,包括组装和混料的物料编码都打印成 pdf
> (共两张保存在文件夹内)」。
> 产出:`pdf/` 下两张 PDF,每张 1 页(中一刀 210×148.5mm 横打)。

## 一、单子在哪(先看这条)

- 这两张单在 **测试账套 `HSDZ_MES_TEST`**,**正式库 `HSDZ_MES` 里没有**该工单的领料台账(实测 0 行)。
- 台账(`wo_pick_doc`)与明细(`wo_pick_line`):

| 单头 id | 领料类型 | 领料单号 | 状态 | 明细行 |
|---|---|---|---|---|
| 860 | 组装 | LL-2026-11-0051 | 未完成 | 2(`C-89-04**TB` 半成品 1000 支 + `YJ-KBL-012` PE袋 50 个) |
| 861 | 混料 | LL-2026-11-0052 | 未完成 | 5(`YJ-XH-002`/`YJ-YPS-002`/`YJ-ZX-003`/`YJ-SLD-009`/`KG-AJE-A01`) |

- 状态是**未完成**,所以「实发数量」全为空(生单时恒为 0,扫码确认才写值,见
  `docs/development/混料领料-两张单与物料清单口径.md` §四);组装单第 1 行 `C-89-04**TB` 是**半成品**
  (编码含 `**TB`),按口径**只显示、不领料**,所以它的实发永远是空。

## 二、怎么生成的(可复跑)

```powershell
cd D:\YINJIA-main\tools
$env:YINJIA_SQL_PASS='Yinjia@2026'
# ① 取两份纸面载荷(JSON)
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" yinjia env `
  archive\_pick-slip-pdf-20261117\04-payload.sql > archive\_pick-slip-pdf-20261117\04-payload.out.txt
# ② 生成纸面 HTML(qrcode 由 frontend/node_modules 提供)
cd archive\_pick-slip-pdf-20261117; node gen-slips.mjs
# ③ ego 浏览器 Page.printToPDF 落 PDF(preferCSSPageSize 认 @page 的 210×148.5mm)
cd D:\YINJIA-main
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117/print-pdf.mjs')"
```

版式来源 = `frontend/src/business/print-formats.js` 的 `pickSlipHtml()`(浏览器打印层/打印代理同一张纸)。
**唯一改动**:`订单号` 右侧加一列 **物料编码** —— 用户这次点名要「物料编码都打印」,而系统原纸面
七列只有「材料名称」(页面明细本来就显示 物料编码/规格型号/计量单位,见 `MobilePickDoc.vue`)。
列宽做了相应收缩,并把「订单号」字号降到 7.6pt,避免 `GD-2026-11-0009#1` 被省略号截断
(原版 17% 宽 + nowrap 会截成 `GD-2026-11-0009…`)。

## 三、验收证据

| # | 验什么 | 结果 |
|---|---|---|
| 1 | 页数 | `_PdfPageSize`:**pages=1 / pages=1** |
| 2 | 纸张 | 594.96×420.96 pt = **209.89×148.51 mm**(中一刀,横向;Chrome 按 1/300in 取整,误差 0.11mm) |
| 3 | 纸面几何 | DOM 实测 `.card` = 794×561 CSS px = **210×148.5mm**,`table` 宽 748px 占满版心 |
| 4 | 文本层可解 | `tools/_PdfText.java`(openpdf)解出全部汉字:标题「生产领料单(组装)/(混料)」、No、日期、8 个列头、每行物料编码/名称/规格/数量、四条签名 |
| 5 | 二维码 | 组装 `0@GD-2026-11-0009@1001@A`、混料 `…@M`(与后端 `printPayload` 同口径,第 4 段 = 领料标记) |
| 6 | 目检 | `pdfshot-组装.png` / `pdfshot-混料.png`(ego 的 PDF 阅读器 1/1 页截图)、`shot-*.png`(HTML 层) |

> 「领料部门」在纸面上是空的:后端 `printPayload` 压根没有这个字段(打印站点透传也是空串),
> 系统原纸面同样空白 —— 不是这次生成时漏了。

## 四、第二轮:物料编码二维码(用户 2026-11-17 追问「我要的是物料编码对应的二维码」)

第一版把「物料编码」当**纸面文字列**印在领料单上,扫码用的仍是抬头那个**工单码**;
用户要的是**每个物料编码自己的二维码** ⇒ 重新出两张 A4 竖版「物料编码二维码」纸:

| 单 | PDF | 编码(二维码内容) |
|---|---|---|
| 组装 | `pdf/物料码二维码-GD-2026-11-0009-行1-组装-LL-2026-11-0051.pdf` | `0@C-89-04**TB`、`0@YJ-KBL-012` |
| 混料 | `pdf/物料码二维码-GD-2026-11-0009-行1-混料-LL-2026-11-0052.pdf` | `0@YJ-XH-002`、`0@YJ-YPS-002`、`0@YJ-ZX-003`、`0@YJ-SLD-009`、`0@KG-AJE-A01` |

**码内容口径(不是自创)**:`公司代码@存货编码[@批号]` = `0@<物料编码>`(本单批号全空 ⇒ 两段)。
依据:`src/core/panel/companyCode.js`(公司代码常量 `'0'`)、`print-formats.productCardQrText()`(商品标识卡)、
`scanPick.parseBarcode()`(条码管理 2026-10-21 起的材料仓新码)、`MobilePick.vue.applyScan()` 注释
「物料码 `0@YJ-ZZ-001` → 物料编码,不带批次 ⇒ 列出该物料全部批次」。

版式:一张纸 = 一张领料单的全部物料编码,每料一张卡(二维码 40×40mm + 物料编码 13pt 等宽粗体 +
名称/规格/单位/请领数量 + 码内容原文),A4 竖版、双列;**半成品**卡上标「半成品·免领」。

复跑:

```powershell
cd D:\YINJIA-main\tools\archive\_pick-slip-pdf-20261117
node gen-qr-sheets.mjs                       # 出 qr-组装.html / qr-混料.html
cd D:\YINJIA-main
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_pick-slip-pdf-20261117/print-qr-pdf.mjs')"
```

验收:

| # | 验什么 | 结果 |
|---|---|---|
| 1 | 页数/纸张 | 各 **1 页**,594.96×841.92 pt = **209.89×297.01 mm**(A4 竖版) |
| 2 | **二维码真能解** | OpenCV `QRCodeDetector` 解整页截图:**组装解出 2/2、混料解出 5/5**,内容与上表逐字一致 |
| 3 | 文本层 | `pdf/物料码-组装.txt`、`pdf/物料码-混料.txt`:标题/工单#行号/领料单号/每个编码/名称/规格/单位/请领数量/码内容原文全在 |
| 4 | 版面 | DOM 实测:sheet 793.7px = 210mm,grid 703px(186mm 版心),card 90.5mm × 52mm,二维码 40mm |

## 五、文件清单

- `00-cols.sql` / `01-probe.sql` / `02-probe.sql` / `03-lines.sql` / `04-payload.sql` — 取数探针
- `04-payload.out.txt` — 两份纸面载荷(原始 SqlRunner 输出,`gen-slips.mjs` 直接读它)
- `gen-slips.mjs` — 纸面 HTML 生成器(复刻 `pickSlipHtml` + 物料编码列)
- `gen-qr-sheets.mjs` / `print-qr-pdf.mjs` — 物料编码二维码纸(HTML 生成 / 落 PDF)
- `shot-qr-sheets.mjs` + `decode_qr.py` — 整页截图 + OpenCV 解码复核
- `measure-slip.mjs` / `measure-qr.mjs` — 版面几何实测
- `print-pdf.mjs` — ego 落 PDF(`Page.printToPDF`)
- `shot-slips.mjs` / `shot-pdf.mjs` — 目检截图(HTML 层 / PDF 阅读器层)
- `_PdfPageSize.java` — 页数 + 纸张尺寸校验
- `pdf/生产领料单-GD-2026-11-0009-行1-组装-LL-2026-11-0051.pdf`
- `pdf/生产领料单-GD-2026-11-0009-行1-混料-LL-2026-11-0052.pdf`
- `pdf/组装.txt` / `pdf/混料.txt` — 文本层抽取结果
