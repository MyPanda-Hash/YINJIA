# 打印通道统一(2026-10-20)—— 取证与复跑

> 任务:用户报「商品(INV)的二维码打印也卡死了」,并要求**单据、仓位、采购订单打印材料码**
> 一律改成和商品标识卡**同一种打印方式**(同一条出纸通道);完成后一并修复处理。

## 一、根因(一句话)

旧打印走 **子窗口**:`window.open` + 子窗口 `document.write` + 子窗口 `window.print()`。
同源弹窗与主页面**共用一个渲染进程**,打印预览/虚拟打印机(WPS 虚拟 PDF)一卡,
主页面跟着僵死、刷新也救不回来。2026-10-19 只把「打印工单」改成了页面内打印,
**商品/仓位/采购单据/二维码标签仍在弹窗那条路上** ⇒ 这次一起收进来。

## 二、改了什么

| 文件 | 改动 |
|---|---|
| `frontend/src/core/panel/printChannel.js`(新增) | 全系统唯一的出纸通道 `printInPage(title, bodyHtml)` + `isPrintHostMounted()`;打印层挂 body、`@media print` 隐藏主界面、`afterprint` 摘层并还原标题、3 分钟兜底 |
| `frontend/src/business/print-formats.js` | 删除 `openPrintWindow`;采购订单 / 采购订单无金额 / 退货单 / 商品标识卡 / 仓位标识卡 / 生产任务单 / 工单任务单**全部改走 `printInPage`** |
| `frontend/src/core/views/QrLabelDialog.vue` | 二维码标签弹窗(工单二维码/产品二维码/暂收单与条码三面板标签)改走同一通道,打印样式收窄到 `#yj-print-host` |
| `frontend/src/core/views/PanelxList.vue` | 单据打印收尾即摘 `@page`(`doc-print-page`),不再让 A4 规则常驻串到标签打印 |
| `frontend/src/core/panel/printChannel.test.js`(新增) | 3 条:挂层→print→摘层还原标题;连打两次不叠层;空内容/空 title |
| `frontend/src/business/print-formats.test.js` | mock 从 `window.open/fakeDoc` 改成抓 `#yj-print-host`;`window.open` 故意不存在(写回去即 TypeError) |

采购订单「打印材料码」经 `MaterialLabelDialog → engine.printProductCards` 自动跟随,无需单独改。

## 三、复跑(两个探针,零写库)

```bash
# 前提前端热更在跑(frontend/start-vite.bat → http://localhost:5173)
cd /d/workspace/yinjia
node tools/archive/_print-unify-1020/_probe-inpage-print.mjs            # 15 项
node tools/archive/_print-unify-1020/_probe-qr-dialog-ui.mjs            # 11 项
cd frontend && node --test src/core/panel/printChannel.test.js \
  src/business/print-formats.test.js src/business/wo-qr.test.js         # 15 项
```

实测结果(2026-10-20,headless Edge + CDP,5173):

- `_probe-inpage-print.mjs` **15/15 PASS**。关键几项:
  商品标识卡 / 仓位标识卡 / 采购订单 都走页面内打印层(`window.print` 各 1 次、层上 `display:none` 不闪屏、
  `afterprint` 后层与 CSS 摘净、标题还原);**全程页面数 3 → 3(没开任何新窗口)**;
  `Page.printToPDF({preferCSSPageSize:true})`:**3 张卡 = 3 页,MediaBox 75×100mm**(落纸校验,样张 `_out-cards.pdf`);
  打印后主线程 ping 最长 109ms。
- `_probe-qr-dialog-ui.mjs` **11/11 PASS**。真挂 `QrLabelDialog` + 真鼠标点「打印」:
  2 张标签卡 + 二维码图 + LOT 段进层,标题=标签名,不开新窗口、无未捕获异常(版式样张 `_out-qrdlg-print.png`)。

## 四、目视样张

- `_out-print-layer.png` —— 商品标识卡在 print 媒体下的样子(75×100mm、七字段、二维码右下角)
- `_out-qrdlg-print.png` —— 二维码标签弹窗出纸(两列网格,编码/名称/LOT/供应商/数量·单据)
- `_out-cards.pdf` —— printToPDF 样张(3 页,每页 75×100mm)
