# 送货单带二维码 + 标识卡二维码带每箱数量(2026-11-24)

> 用户口径(2026-11-24,附打印预览截图):
> **「1.图片的送货单要带二维码」**(截图红框标注扫码内容 = **订单编号+物料编码+物料数量**)
> **「2.标识卡的二维码要带每箱数量」**
> 追问两处格式后拍板:
> · 一张单多个物料行 ⇒ **「一个二维码显示全部行」**(整单一个码,不是每行一个);
> · 标识卡码格式 ⇒ **公司代码@物料编码@批号@每箱数量**(第 4 段 = 每箱)。

## 一句话结论

| 纸面 | 改动 | 二维码内容 |
|---|---|---|
| **送货单**(采购订单·无金额版) | 页头右上角新增**一个**二维码(26mm,信息区右移让位) | `订单编号@物料编码@数量` 按行串联,记录间用 `;`<br>例:`YJ-20261116-03@YJ-KBL-028@1440;YJ-20261116-03@YJ-KBL-029@50` |
| **标识卡**(材料码打印) | 二维码右下角那一格不变,内容多一段 | `公司代码@物料编码@批号@每箱数量`<br>例:`0@YJ-KBL-028@20261021@200` |

## 关键设计取舍

1. **整单一个码、记录间用 `;` 而不是换行**:现场扫码枪是键盘仿真,码里的换行等于敲回车,
   多行记录会被拆成多次输入(收货端只拿到第一行)。`@` 沿用标识卡/工单码的既有分段口径。
2. **第 4 段(每箱数量)只在「批号段非空」时才补**:三段码的第 3 段会被扫码端当成批号,
   批号空着补段会变成 `0@编码@200`(每箱数量被误读成批号)。材料码打印的批次号本来就必填
   (`MaterialLabelDialog` 会拦空),所以实际出纸恒为 4 段。
3. **不带每箱数量的老入口一字不变**:商品档案「二维码标签」、采购入库单「打印标识卡」仍是 2/3 段码
   (它们没有每箱数量这个概念)。
4. **送货单版式函数改成 async**:二维码要现算(qrcode 出图是 Promise)⇒ `printPuOrderNoAmount`
   与 `printProductionTask` 同款;**三个调用点全部 `await`**(打印弹窗 2 处 + 面板直接出纸兜底 1 处)。
5. **出图失败不挡出纸**:二维码生成抛错只 `console.warn`,纸面其余内容照打(送货单没有码也能做事)。

## 改了哪些文件

| 层 | 文件 | 要点 |
|---|---|---|
| 前端 | `frontend/src/business/print-formats.js` | 新增 `deliveryNoteQrText()`(纯函数,可单测);`printPuOrderNoAmount` 改 async + 页头 `.head/.hdqr` 版式 + 26mm 二维码;`productCardQrText` 支持第 4 段;`PU_SHEET_CSS` 加页头行 CSS |
| 前端 | `frontend/src/core/views/MaterialLabelDialog.vue` | `cardsOf()` 每张卡带 `每箱数量`(整箱卡印每箱、零头卡印零头,二维码恒带**每箱**) |
| 前端 | `frontend/src/core/views/PurchaseOrderPrintDialog.vue` | 两处 `const ok = printFn(...)` → `await`(无金额版已是 async) |
| 前端 | `frontend/src/core/views/PanelxList.vue` | 兜底直打分支 `await printPuOrderNoAmount(...)` |
| 前端 | `frontend/src/business/scanPick.js` | `parseBarcode` 允许 **4 段**(第 4 段=每箱数量,非正数仍按 `too-many` 拦;三段老码不带 `boxQty` 键,行为不变) |
| 前端 | `frontend/src/core/panel/companyCode.js` | 注释补 4 段口径 + 送货单码(不以公司代码开头) |
| 测试 | `frontend/src/business/print-formats.test.js` | +3 条:送货单码内容 / 纸面只出 1 个码且内容等于 `deliveryNoteQrText` / 标识卡第 4 段(含"批号空不补段");3 处旧调用改 `await` |
| 测试 | `frontend/src/business/scanPick.test.js` | +1 条:4 段码拆出 `boxQty`、第 5 段与第 4 段非正数仍 `too-many` |
| 产物 | `backend/src/main/resources/static` | 前端静态产物同步(单独一个 `chore:` 提交) |

**无数据库改动**:两个字段都已在库里(`bl_pu_label.[每箱数量]` 2026-11-11 建),本任务只改纸面与码内容
⇒ 不需要迁移脚本、不涉及多语言数据(纸面事实文案不入 `tt()`,ADR-0001)。

## 验证证据

### 单测 / 门禁

```
cd frontend
node --test src/business/print-formats.test.js src/business/scanPick.test.js   # 75/75 通过
node --test                                                                     # 2559 条,2 条失败为既有问题(见下)
npm run build                                                                   # ✓ built
```

既有的 2 条失败**与本任务无关**(工作区未改那两个文件):
`goodsPick.test.js ⑬`(缺 `matPickCache` 缓存断言)、`recordSheetConfigs.livedb.test.js RD_`
(需要连库的 livedb 用例)。

### ego 浏览器实测(真实代码路径)

| 轮次 | 脚本 | 结论 |
|---|---|---|
| 01 | `ego/round-01.mjs` | 直接调 `printPuOrderNoAmount`(真实出纸函数,只把 `window.print` 打桩):`hdqrCount=1`、码面 **98px ≈ 26mm**、内容 `YJ-20261116-03@YJ-KBL-028@1440;YJ-20261116-03@YJ-KBL-029@50`;标识卡 `qrText=0@YJ-KBL-028@20261021@200`、卡 283×378px = 75×100mm |
| 03 | `ego/round-03.mjs` | 会话切到**测试库**(`YJ_TEST`)再看采购订单列表,避免把验证数据写进正式账套 |
| 04 | `ego/round-04.mjs` | **真实点链路**:工具栏「打印▼」→ 打印订单无金额 → 弹窗「确定并打印」→ 纸面 `hdqr=1`、码图 1846 字符、`window.print` 调 1 次、提示「已登记打印记录 MP-2026-11-0004」 |
| 05/06 | `ego/round-05.mjs` / `round-06.mjs` | 收尾:作废测试库那张验证记录(`作废行数 1`)、关弹窗、**会话登回正式库 YJ**(`factory={"code":"YJ"}`) |

截图:`round-01-delivery-note.png`(送货单+右上角码)、`round-01-label-card.png`(75×100mm 标识卡)、
`round-04b-delivery-note-real.png`(真实链路出的送货单)、`round-03-pu-list-test-db.png`(测试库环境)
——**png 被仓库 `.gitignore` 忽略**,按上面「复跑」的命令现场重生成即可。

## 复跑

```powershell
# 单测
cd D:\YINJIA-main\frontend
node --test src/business/print-formats.test.js src/business/scanPick.test.js

# 纸面取证(ego,不写库:直接调出纸函数 + 打桩 window.print)
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/.dsh/../_scratch/ego-delivery-qr-20261124/round-01.mjs')"

# 真实点链路(会往**测试库**落一张打印记录;脚本末尾有作废步骤)
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/_scratch/ego-delivery-qr-20261124/round-04.mjs')"
```

## 已知边界

- **码长**:每行记录约 35 字,26mm 码在 **≤20 行**时仍清晰可扫;行数再多码面会变密
  (超长单建议按行拆单打印)。
- **扫码端还没做**:MES 侧目前没有「扫送货单码直接收货」的界面,本次只统一**出码**口径;
  将来做收货扫描时,送货单码 = `订单编号@物料编码@数量;…`(首段不是公司代码,可与标识卡码区分)。
- **标识卡码第 4 段是「每箱数量」不是「本箱数量」**:零头箱那张卡印的数量是零头(卡面),
  二维码里仍是每箱数量(用户口径「标识卡的二维码要带每箱数量」)。
