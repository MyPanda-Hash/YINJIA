# 采购入库单转ERP「商品分录已关闭，不允许下推」排查(2026-11-11)

## 现场

- 面板:采购入库单 `PURCHASE_IN`,单据 `PI-2026-11-0036`(单据日期 2026-11-11,批次号 20261111)
- 供应商:惠州市康佰利包装材料有限公司(`YJ-KBL`),采购订单号 **`YJ-20261103-01`**
- 行:`YJ-KBL-002` 热缩袋 100*350,实收数量 **12000** 个
- 报错:`服务异常：转ERP失败: 金蝶接口失败: 请求接口返回失败: 不符合条件: 商品分录已关闭，不允许下推。`

## 一、结论(已用真实账套取证,不是推断)

**订单 `YJ-20261103-01` 的第 1 行(seq=1,`YJ-KBL-002`)在 2026-11-05 就被收满了,金蝶已把它自动关闭;
这次要把 12000 个同一物料继续挂在这一行上「下推」,所以被拒。**

金蝶真实账套(outerInstanceId 580147507460444160)订单详情实测:

| seq | 物料 | qty | in_qty(已入库) | un_out_qty(未执行) | close_state | 说明 |
|---|---|---|---|---|---|---|
| **1** | **YJ-KBL-002 热缩袋** | **10000** | **10000** | **0** | **0 已关闭** | ← 本单要挂的就是这一行 |
| 2 | YJ-KBL-005 | 10000 | 10000 | 0 | 0 已关闭 | |
| 3 | YJ-KBL-005 | 10000 | 10000 | 0 | 0 已关闭 | |
| 4 | YJ-KBL-022 | 5000 | 0 | 5000 | 1 未关闭 | |
| 5 | YJ-KBL-023 | 5000 | 0 | 5000 | 1 未关闭 | |
| 6 | YJ-KBL-019 | 5000 | 5000 | 0 | 0 已关闭 | |
| 7 | YJ-KBL-016 | 24 | 24 | 0 | 0 已关闭 | |
| 8 | YJ-KBL-016 | 12 | 12 | 0 | 0 已关闭 | |
| 9 | YJ-KBL-012 | 4000 | 2500 | 1500 | 1 未关闭 | 部分入库 |
| 10 | YJ-KBL-011 | 400 | 0 | 400 | 1 未关闭 | |

表头:`bill_status=C`(已审核)、`bill_close_state=C`(整单未关闭)、`io_status=Z`(部分入库)
⇒ **关闭的是行级分录,不是整单**;一行的 `in_qty` 达到订单数量后金蝶自动置 `close_state=0`,
该行不再允许被下推(`EntryCloseState` 语义:`0` 已关闭 / `1` 未关闭 / `2` 手动关闭)。

## 二、谁把这一行收满了(铁证)

扫描金蝶近 300 张采购入库单明细(只读 GET),挂 `YJ-20261103-01` 的只有两张,均为 2026-11-05:

```
CGRK-20261105-03626 | 2026-11-05 | 已审核 C | seq=1 | YJ-KBL-002 | qty=10000 | src_seq=1 | batch=PC0000
CGRK-20261105-03626 | 2026-11-05 | 已审核 C | seq=2 | YJ-KBL-005 | qty=10000 | src_seq=3 | batch=PC0000
CGRK-20261105-03626 | 2026-11-05 | 已审核 C | seq=3 | YJ-KBL-016 | qty=12    | src_seq=8 | batch=PC0000
CGRK-20261105-03626 | 2026-11-05 | 已审核 C | seq=4 | YJ-KBL-012 | qty=1500  | src_seq=9 | batch=PC0000
CGRK-20261105-03617 | 2026-11-05 | 已审核 C | seq=1 | YJ-KBL-005 | qty=10000 | src_seq=2 | batch=PC0000
CGRK-20261105-03617 | 2026-11-05 | 已审核 C | seq=2 | YJ-KBL-019 | qty=5000  | src_seq=6 | batch=PC0000
CGRK-20261105-03617 | 2026-11-05 | 已审核 C | seq=3 | YJ-KBL-016 | qty=24    | src_seq=7 | batch=PC0000
CGRK-20261105-03617 | 2026-11-05 | 已审核 C | seq=4 | YJ-KBL-012 | qty=1000  | src_seq=9 | batch=PC0000
```

即 **11-05 已经把订单里 6 行(seq 1/2/3/6/7/8)全部收满**(YJ-KBL-002 就在其中,10000 个),这些分录因此关闭;
只剩 seq 4/5/9(部分)/10 还开着。11-11 这张 12000 个 `YJ-KBL-002` 再挂回去,自然被挡。

旁证:这两张入库单的 `batch_no=PC0000`(金蝶给无批次商品的默认批号),而 MES 转ERP 一定会带 MES 批次号
(如 20261111)⇒ 它们**不是 MES 推过去的**,是在金蝶里手工按订单下推/录入的。
MES 侧 `HSDZ_MES_SRV`(2026-11-11 11:13 服务器账套快照)11 月最早一张采购入库单是 `PI-2026-11-0006`(11-06),
11-05 没有对应 MES 单据 —— 所以 **MES 至今不知道这一行已收满**,这正是坑。

## 三、报错链路(代码)

1. `ButtonService#pushToErp`(ButtonService.java:5816) → 包一层「转ERP失败:」
2. `KingdeePushService#pushDocument`([:167](file:///D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/KingdeePushService.java)):
   单头有「采购订单号」⇒ `resolvePoRefs()` 解析到金蝶订单与分录 ⇒ `linkSrc=true`
3. 每行带上 `src_bill_no` + **`src_bill_type_id=pur_bill_order`** + `src_inter_id` + `src_seq/src_entry_id`,
   POST `/jdy/v2/scm/pur_inbound`
4. **带上 `src_bill_type_id` 后金蝶就按「从源单下推」校验**([代码注释 387-395 行](file:///D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/KingdeePushService.java)记录的实测事实);
   分录已关闭 ⇒ 整单被拒,`errcode!=0` 时把金蝶原文抛回前端([:641-643](file:///D:/YINJIA-main/backend/src/main/java/com/yinjia/mes/service/KingdeePushService.java))

> 不是凭证/网络/字段格式:解析不到商品会先报「商品档案中无对应ID」;订单找不到会**降级**(不挂来源单)。
> 能报出「分录已关闭」说明订单解析成功、`src_*` 组确实发出去了,金蝶纯粹是就**源单分录状态**拒绝。

## 四、处置(业务拍板)

1. **最可能:重复收货** —— 11-05 已收过 10000 个 `YJ-KBL-002`,这张又收 12000(还超订单量 2000)
   ⇒ 核实后作废/删除该入库单。
2. **确实又到了一批(超收/无单入库)** —— 把该单(或该行)的**采购订单号清空**再转:代码对"头上无订单号"
   是明确支持的(不挂 `src_*`,按普通采购入库单推送,只记 warn)。
3. **要保挂单** —— 只能在金蝶新增订单行(或补订单)再挂;**不要**指望反关闭 seq=1:它 `in_qty=10000=qty`,
   反关闭后重推会改成报「不允许超量入库」(同 2026-11-07 的 `PI-2026-11-0018` 事故,见
   `tools/archive/_erp-overreceive-20261107/README.md`)。

## 五、代码可改进(未实施,待确认)

- **推前预检**:`resolvePoRefs()` 已经在拉订单详情,顺带读 `material_entity[].close_state / in_qty / un_out_qty`,
  命中已关闭行就直接给出人话:「订单 `X` 第 N 行(YJ-KBL-002)已入库完毕(10000/10000)并自动关闭,
  请清空采购订单号或新增订单行」,而不是把金蝶原文甩给用户;
- **同步落库**:`bl_pu_order` 的 `行关闭状态 / 行已执行数量 / 行未执行数量` 目前恒 NULL(`Probe2` F 段实测),
  同步时把金蝶这三个字段写进去,MES 侧就能在生单阶段拦住"往已关闭行上收货"。

## 六、复跑(全部只读)

```powershell
# 真实账套(359797 / outerInstanceId 580147507460444160),只发 GET:
node tools\archive\_erp-closed-segment-20261111\_q-real-order.mjs YJ-20261103-01   # 订单头+分录 close_state/in_qty
node tools\archive\_erp-closed-segment-20261111\_q-scan-inbound.mjs 3              # 扫 300 张入库单,谁挂了这个订单

# 服务器账套快照(HSDZ_MES_SRV):
cd tools; java -cp lib\mssql-jdbc.jar ..\tools\archive\_erp-closed-segment-20261111\Probe5.java HSDZ_MES_SRV YJ-KBL-002
```

- `deploy/config.json` = 真实账套(359797);`deploy/push/config.json` = 沙箱(359220),**别用错**。
- `PI-2026-11-0036` 在服务器库快照(11:13)里还没有(单据 13:32 才审核),故 MES 侧证据取到 `PI-2026-11-0033` 为止。
