# 采购订单打印:需方联系人 / 联系方式「可以删除数据」(2026-11-16)

用户口径(截图红框圈住打印弹窗顶部两个下拉):

> 「打印的这两个填写需要可以删除数据的。」

## 一、先复现,再动手(病根)

`.pup-buyer-sel` / `.pup-buyer-tel` 两个 `el-select` 本来就带 `clearable`(悬停出 ⓧ),
**清空本身是成功的** —— 但清空后打印,纸面「需方」框又出现联系人:

```
round-12(改前取证):
  弹窗里  需方联系人 = placeholder「选择或输入联系人」/ 联系方式 = placeholder
  纸面    需 方 … 联 系 人：孙郝聪  联系方式：13718162430   ← 用户看到的"删不掉"
```

原因在两条链的接缝:

| 位置 | 旧行为 |
|---|---|
| `PurchaseOrderPrintDialog.buyerOf()` | 两个都空 ⇒ 返回 `null`(当成"没有需方信息") |
| `print-formats.puSignHtml(supplier, buyer)` | `buyer \|\| COMPANY.buyer` ⇒ `null` 回落到公司默认那组 |

⇒ 用户把两个框删空,出纸时被 `null → COMPANY.buyer` 悄悄补了回去。

## 二、改了什么

| 文件 | 改动 |
|---|---|
| `frontend/src/core/views/PurchaseOrderPrintDialog.vue` | ① `buyerOf()` 在**有金额**版式下原样传当前两个值(空就是空),回落只留给压根没传 `buyer` 的老调用;② 顶部加显式「清空」按钮(一次清掉两个,空时置灰),下拉保留悬停 ⓧ;③ 说明补一句「不填(点「清空」)则需方框不印联系人和联系方式」,另起一行,`pup-buyer-tip` 给 flex 基宽避免把按钮挤到第二行;④ 名单管理(上一轮未提交部分)一并收口 |
| `backend .../PxController.java`、`PuPrintService.java` | 名单整份覆盖 `PUT /px/puPrint/buyerContacts` + `saveBuyerContacts`(人数上限/去空/去重,一条不剩则拒) |
| `frontend/src/business/engine.js` | `puPrintBuyerContactSave` |
| `frontend/src/business/print-formats.test.js` | 新增 1 条:传空 `buyer` ⇒ 纸面留空且不含公司默认值;原「不传 buyer 仍回落默认」保持 |
| `frontend/src/i18n/locales/*.js` ×10 | 新提示句 10 语言 |
| `docs/development/数据库表清单.md` | v3.99 一行(无表结构变更) |
| `backend/src/main/resources/static` | `tools/scripts/apply-frontend-only.ps1` 重新构建并换进 8090(入口 `assets/index-C91qsNFI.js`) |

纸面口径:**清空 = 需方框印空**(留给对方手填),不再回落 `COMPANY.buyer`;
`PanelxList` 里「打印采购订单」直打(不弹窗、不传 `buyer`)仍按老纸回落默认那组。

## 三、验证(ego 浏览器,可复跑)

脚本与截图在 `ego/`,执行:`ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_pu-buyer-clear-20261111/ego/round-NN.mjs')"`
(taskSpace id 会变,脚本里固定写了 3,复跑时按当前打印出的 id 改)。

| round | 做什么 | 结果 |
|---|---|---|
| 01–09 | 登录 → 采购订单 → 打开 PO-2026-11-0012 → 打印弹窗 → 摸两个下拉的 DOM | ⓧ 存在(396 处 `clearable` 在包内),清空可用 |
| **12** | **改前**:清空两个框 → 点「确定并打印」→ 读 `#yj-print-host` | ❌ 纸面 `联 系 人：孙郝聪 / 联系方式：13718162430`(**病根取证**) |
| 13 / 17 / 18 | 改后:弹窗里出现「清空」按钮 + 两句说明;点清空 → 两个下拉回 placeholder、按钮置灰 | ✅ 单行版式,`round-18-row.png` |
| **15** | 清空后「重打」→ 抓 `window.print` 时的纸面 HTML | ✅ `需 方 … 联 系 人：<空> 联系方式：<空>` |
| 19 | 重开弹窗(默认仍取名单第一条)→ 重打 | ✅ 仍是 `孙郝聪 / 13718162430`,默认路径回归未破 |
| 20 / 21 | 名单管理:加一行「探针小李」保存 → 删掉再保存 | ✅ toast「名单已保存」,名单回到只剩 `孙郝聪`(探针已清) |
| **23** | 8090 打包版同一套流程 | ✅ 清空后重打纸面需方框为空 |
| 24 / 25 | 8090 截图取证 + 作废本次测试落的 `MP-2026-11-0003` | ✅ 记录数回到 0 |

其它:`node --test` **1850/1850** 通过;`npm run build` 通过;
`apply-frontend-only.ps1` 输出 `[OK] http://127.0.0.1:8090 已下发 assets/index-C91qsNFI.js`。

## 四、踩过的坑

1. **`null` 与空值的语义差别**:`null` 被下游解释成"没传",于是"用户删掉了"和"调用方没给"合流 —— 凡是"用户可删"的字段传给下游时,必须用**空值**表达,别用 `null`/不传。
2. **`clearable` 不等于"能删"**:悬停 ⓧ 只有 14px,用户找不到;给了显式按钮 + 一句说明之后才叫"可删除"。
3. **弹窗里一行说明加长会把后面的按钮挤到第二行**:`display:flex; flex-wrap:wrap` 的容器里给长文本块加 `flex: 1 1 300px; min-width` 让它自己折行(`round-16` 的 800px 一行就是反例)。
