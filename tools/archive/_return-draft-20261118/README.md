# 生产退料单"提交即已审核"→ 改为只生成草稿(2026-11-18)

> 用户报障原话:「生产退料单怎么自动审批了,所有生成的单都要是草稿状态」。

## 一、根因:手机提交退料时**替仓管点了「审核」**

`MobilePickController.submitReturn()` 生成退料单之后,紧跟着一句:

```java
String backNo = saveDoc(PANEL_BACK, backForm);              // 存成草稿
buttons.callButton(PANEL_BACK, "审核", docNoForm(backNo), null);  // ← 现场看到的"自动审批"
```

后果:手机一点提交,单据当场变**已审核**、`StockLedgerService.postIn(MATERIAL_RET)` 立刻把库存加回来 ——
面板里根本看不到"待审"的退料单,仓管失去了这道复核。而同一个控制器里,**材料出库单**早在
2026-11-01 就是"提交只建单、审核才过账"的口径(`MobilePickController` §1140 附近注释),
退料这一条是唯一的例外。

## 二、改法

1. **删掉自动审核**(`MobilePickController.submitReturn`):只 `saveDoc`,单据留在**草稿**;
   库存仍然要等仓管在「生产退料单」面板点「审核」时,由 `StockLedgerService` 过账。
   回执里补 `单据状态: 草稿` + 说明文案「(草稿,待仓管在「生产退料单」里审核后入库)」。
2. **退料台账仍然提交即写**(`wo_pick_return`):"可退量 = 已领 − 已退"必须**提交即扣**,
   否则两个操作员能把同一批料各退一遍。⇒ 配套补了**作废放回**:
   `ButtonService.voidDoc()` 里对 `MATERIAL_RET` 作废时把该单号的台账行 `asp_cancel='Y'`,
   可退量立刻回补(草稿被作废 = 这次退料没发生,不放回就是"一张废单永久吃掉可退量")。
3. 前端确认框文案改掉(原文写"生成一张生产退料单并入库,库存会增加"):
   「提交后生成生产退料单(草稿),要等仓管审核后库存才会增加。确定提交?」——
   en/ja 语言包同步补译名(其余语言包原本就没有这句旧译名,`tt()` 回落原文)。

## 三、验证(测试账套 HSDZ_MES_TEST,HTTP 实测)

### ① 提交退料 → 只出草稿,库存不动

```
POST /api/px/mobilePick/submitReturn {id:860, items:[{code:'YJ-KBL-012', qty:0.5}]}
→ {"退料单号":"TL-2026-11-0017", …, "单据状态":"草稿",
   "说明":"已生成生产退料单 TL-2026-11-0017(草稿,待仓管在「生产退料单」里审核后入库)"}

bd_material_ret   TL-2026-11-0017 | 单据状态(列)空 | 领用人 admin | 1 行
yj_doc_status     MATERIAL_RET | TL-2026-11-0017 | 审核人 空 | 待审 N | 作废 N   ← 草稿
kucun(YJ-KBL-012) 退料前后完全一致(全部 0.0)                                 ← 库存没动
wo_pick_return    LL-2026-11-0051 | YJ-KBL-012 | .5000 | TL-2026-11-0017 | N   ← 台账已扣
```

### ② 作废这张草稿 → 台账放回、可退量恢复

```
POST /api/px/callButton {panelCode:'MATERIAL_RET', buttonName:'删除', formData:{编号:'TL-2026-11-0017'}}
→ {"单据状态":"已作废","编号":"TL-2026-11-0017"}

yj_doc_status.canceled = Y
wo_pick_return.asp_cancel = Y        ← 台账放回
GET /px/mobilePick/doc?id=860 → 已退合计 1.5 → 1.0(可退量回补)
```

### ③ 审核仍然照旧过账(未改动的既有链路)

仓管在「生产退料单」面板点「审核」→ `ButtonService.audit` → `StockLedgerService.postIn(MATERIAL_RET,…)`,
这与所有别的单据同一条路(本次没碰)。

## 四、复跑

```powershell
# 1) 提交(需要 MATERIAL_OUT 已完成 + 出库已审批的领料单;id=860 = LL-2026-11-0051)
#    POST /api/auth/login {userName:admin,password:123456,factory:YJ_TEST} 拿 token
#    POST /api/px/mobilePick/submitReturn {id:860, items:[{code:'YJ-KBL-012', qty:0.5}]}
#    SELECT 单据状态 FROM bd_material_ret WHERE 单据编号='<新单>';
#    SELECT shr,pending,canceled FROM yj_doc_status WHERE panel_code='MATERIAL_RET' AND doc_no='<新单>';
#    SELECT wzdm,ckdm,lot_no,yl FROM kucun WHERE wzdm='YJ-KBL-012';      -- 应与提交前一致
# 2) 作废草稿
#    POST /api/px/callButton {panelCode:'MATERIAL_RET',buttonName:'删除',formData:{编号:'<新单>'}}
#    SELECT asp_cancel FROM wo_pick_return WHERE 退料单号='<新单>';       -- 应为 Y
```

## 五、注意

- **存量已审核的退料单不动**:之前自动审掉的那些仍在"已审核",需要的话在面板上「弃审」即可
  (弃审会按既有链路把库存冲回,本次没有改弃审逻辑)。
- 手机端要看到新确认文案需换包:`android/dist/yinjia-mes-1.0.23.apk`(versionCode 24,覆盖安装)。
- 这条口径同时写在 `MobilePickController` 类注释「本控制器不做的事」里:**不替仓管审批**,
  以后新增的手机端生单流程(领料/退料/其他领料…)一律只到草稿。
