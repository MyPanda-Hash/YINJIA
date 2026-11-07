# 采购订单打印「可勾选 / 可填数量」取证(2026-11-07)

## 需求(用户原话)

> 采购订单的打印(两个报表一个有金额,一个没有金额)中,需要能够在打印报表的时候编辑
> (像打印材料码的编辑一样),要可以勾选打印和填写数量。

## 改了什么

| 层 | 文件 | 说明 |
|---|---|---|
| core(纯函数) | `frontend/src/core/panel/puPrintRows.js` | `puOrderPrintRows` / `puOrderLineAmount`:勾选的行才落纸、改数量才重算小计(没改的沿用原金额,折扣不被打印抹掉);单测 `puPrintRows.test.js`。 |
| core(弹窗) | `frontend/src/core/views/PurchaseOrderPrintDialog.vue` | 采购订单打印弹窗:勾选明细行 + 每行「本次打印数量」+ 合计;「有金额/无金额」两种版式二选一;取数走 `engine.getFormDescriptor`,出纸走 runtime 的 `printPuOrder` / `printPuOrderNoAmount`。**不写回订单**。 |
| core(接线) | `frontend/src/core/views/PanelxList.vue` | `打印采购订单` / `打印订单无金额` 两个动作(含 `SUPPLIER_PU_ORDER` 供应商采购打印)先开弹窗,不再直接出纸。「打印退货单」及兜底分支保持原样。 |
| business | `frontend/src/business/print-formats.js` | `printPuOrder` / `printPuOrderNoAmount` 返回是否成功交给打印层(弹窗据此关窗/留窗重试),版式与输出不变。 |
| i18n | `frontend/src/i18n/locales/en.js`、`zh-TW.js` | 新增弹窗文案译名(打印版式/有金额/无金额/小计/交期要求/数量提示等)。 |

## 验证证据

单测(npm test 全仓 1546 项通过,含 `puPrintRows.test.js`)之外,界面走 ego 浏览器实测(源码 5173 + jar 内 static 8090 都验过):

| 证据 | 含义 |
|---|---|
| `ego/round-11-edited.png` | 7 行订单里取消勾选第 2 行、第 1 行数量改 1234 ⇒ 底部变为「已选 6/7 行 · 数量合计 11670 · 金额合计 4570.018」,小计 95.018 = 0.077×1234。 |
| `ego/round-12.mjs` 输出(见轮次脚本) | 下拉「打印订单无金额」⇒ 弹窗默认「无金额」,表头无 单价/小计;出纸表头同样无 单价/小计,总计只有数量。 |
| `ego/round-13-dialog.png` | 从「打印」主按钮进入的「有金额」弹窗外观。 |
| `ego/round-13-paper.html` | 实际送进打印层的 HTML(纸张内容):被取消勾选的行不在纸上、改过的数量与小计按本次输入落纸、总计=所选行合计。 |
| `ego/round-14-noamount.png` | 弹窗内「打印版式」切到无金额:单价/小计列与金额合计立即收起。 |
| `ego/round-15-8090.png` | 8090(jar 内 `static`)同一功能可用,入口 chunk = `assets/index-DspAsTQ4.js`(换过 jar)。 |
| `ego/round-16-en.png` | 切到 English 后弹窗全部为目标语言(Print Purchase Order / Ordered Qty / Print qty this time / With amounts / Without amounts / Confirm & Print),验收完已切回简体。 |
| `ego/round-17.mjs` 输出 + `ego/round-17-supplier.png` | 供应商采购打印面板(`SUPPLIER_PU_ORDER`,工具栏只有「打印」)点打印走同一张弹窗;「清空」→ 已选 0、「确定并打印」→ 提示「请至少勾选一行明细」且弹窗不关、「全选」→ 恢复 7/7。 |
| `ego/round-18-reset.png` | 「按订单数量填充」:把第 1 行改成 999、取消勾选第 3 行后点它 ⇒ 数量全部回订单值、7 行重新全选,合计回到 19436 / 8600。 |
| `ego/round-19-supplier-login.png` | **供应商账号实测**:真实点击「退出」→ 用供应商账号 `kbl01` 登录成功 —— 顶栏=「供应商采购打印 · 惠州市康佰利包装材料有限公司(YJ-KBL)」,菜单只剩这一页,左栏 74 张(服务端按供应商编码过滤)。 |
| `ego/round-20-supplier-edited.png` + `round-20.mjs` 输出 | 供应商会话里真实点击「打印」→ **同一张可编辑弹窗**(勾选 + 本次打印数量);取消勾选第 2 行、第 1 行数量键入 1234 ⇒ 已选 6/7、合计 11670 / 4570.018;出纸 6 行 + 总计,被取消的 `YJ-KBL-012` 不在纸上,数量 1234、小计 95.018。 |
| `ego/round-20-supplier-noamount.png` + 输出 | 供应商会话切「无金额」⇒ 弹窗与纸面都没有 单价/小计,总计只有数量 19436。 |

`Q*.java` 是取明细字段/找多行订单的一次性只读探针(`java -cp lib\mssql-jdbc.jar ...` 在 `tools/` 下跑)。

## 供应商账号(实测用哪个、有没有动数据)

用 `kbl01`(绑定 `YJ-KBL`)登录实测 —— 这是既有 e2e 脚本里登记过的冒烟账号
(默认参数见 `tools/archive/_ui-supplier-material-label.cjs`、`_ui-supplier-po-panel.cjs`)。
本次**没有新建账号、没有重置密码、没有启停任何供应商账号**,只读打印,不改任何业务数据。

## 口径说明(为什么打印不落库)
「打印材料码」弹窗要**落库**(批次号权威登记 + 预约数量),所以它有已打印记录/作废/重打;
采购订单报表只是把已保存的订单打出来,勾选与数量若写回会绕过保存/审核链路。
故本弹窗明确只影响**这一张纸**,弹窗顶部那句话就是口径本身:
「勾选要打印的明细行，并填写本次打印数量；只影响这张报表，不改动订单数据」。
