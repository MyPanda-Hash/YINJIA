# 采购入库单转ERP「商品分录已关闭，不允许下推」排查(2026-11-11)

## 现场

- 面板:采购入库单 `PURCHASE_IN`,单据 `PI-2026-11-0036`(单据日期 2026-11-11,批次号 20261111)
- 供应商:惠州市康佰利包装材料有限公司(`YJ-KBL`),采购订单号 `YJ-20261103-01`
- 行:`YJ-KBL-002` 热缩袋 100*350,实收数量 **12000** 个
- 报错:`服务异常：转ERP失败: 金蝶接口失败: 请求接口返回失败: 不符合条件: 商品分录已关闭，不允许下推。`

## 报错链路(代码)

1. `ButtonService#pushToErp`(ButtonService.java:5816) → 包一层「转ERP失败:」
2. `KingdeePushService#pushDocument`(KingdeePushService.java:167):
   - `isPur` → `headTable=bd_purchase_in` / `lineTable=bl_purchase_in`
   - 头上 `采购订单号` 非空 ⇒ `resolvePoRefs(poNo)` 解析到金蝶订单与其分录 id
   - `linkSrc = isPur && poRefs != null` ⇒ 每行带上
     `src_bill_no` + `src_bill_type_id/number/name=pur_bill_order/采购订单` + `src_inter_id` + `src_seq/src_entry_id`
   - POST `/jdy/v2/scm/pur_inbound`;`errcode!=0` 时把金蝶 `description` 原样抛成
     「金蝶接口失败: …」(KingdeePushService.java:641-643)

**关键**:**只要带了 `src_bill_type_id`,金蝶就按「从源单下推」处理,并校验源单该商品分录的关闭状态**
(代码注释 387-395 行记录了这一实测事实)。分录已关闭 ⇒ 整单被拒,文案即
「不符合条件:商品分录已关闭,不允许下推」。

## 本机两侧取证(只读)

`Probe.java` / `Probe2.java`(本目录,`java -cp tools/lib/mssql-jdbc.jar … Probe2.java HSDZ_MES`):

- `PI-2026-11-0036` 在**本机两个账套都不存在**(正式库最新采购入库单是 `PI-2026-10-0116`,2026-10-30)
  ⇒ 报障发生在**服务器账套**,本机库无法直接取该单;本机 `backend/logs` 无该错误,同样佐证。
- 订单 `YJ-20261103-01`(正式库):状态「已审核」、`关闭状态=C`(未关闭)、`入库状态=Z`(部分入库)、
  `是否已转ERP=是`、`ERP单号=YJ-20261103-01`、转ERP时间 2026-11-09 02:24(操作人「试运行」)。
- 该订单行 `YJ-KBL-002` 的**订单数量只有 10000**,而报障入库单实收 **12000**。
- 本机正式库里**没有任何**采购入库单引用该订单(`Probe2` G/H 段为空)。

## 结论(成因)

金蝶侧这行的「商品分录」已处于关闭状态,常见三种来源,按可能性排序:

1. **该订单行已被前序入库单收满**(最可能):金蝶在某行执行完(io_status=C)后**自动关闭该分录**
   (`deploy/金蝶采购订单状态口径.md`:历史 1690 张已关闭单 100% 是 `io_status=C` 全部入库)。
   MES 侧这张单的 12000 是个孤立的超量/二次开单,再挂上去下推就被挡。
2. **人工关闭**:有人(或某个流程)在金蝶把该订单行/整单手工关闭(`bill_close_state=H`、`close_state=2`)。
3. **订单行号对不上**:MES 行上无「源单行号」时只推 `src_bill_no`(不带 `src_seq`),金蝶按整单/整行校验,
   只要沾到已关闭的分录同样整单被拒。

不是网络/凭证/字段格式问题:同链路里若商品档案解析不到会先抛「商品档案中无对应ID」;若订单找不到
会走**降级**(不挂来源单、只提示),不会报这句 —— 所以能报出「分录已关闭」,说明订单解析成功、
`src_*` 组确实发出去了,金蝶是就**源单分录状态**拒绝的。

## 处置

- ① 先核业务:订单 `YJ-20261103-01` 的 `YJ-KBL-002` 只有 10000,若这 12000 属重复/超收 ⇒ 作废该入库单,
  或按"无订单入库"处理;
- ② 若确需继续收(超收/无单入库):把该单(或该行)的**采购订单号清空**后重转 —— 代码对"头上无采购订单号"
  的行为是明确支持的(不挂 `src_*`,按普通采购入库单推送,日志记 warn);
- ③ 若金蝶侧是误关闭:到金蝶采购订单把该行/整单**反关闭**再回 MES 重转(已收满的行需先减少已入库数量,
  否则会改报"下推数量超出来源单未执行数量");
- ④ 代码可改进(未实施,待确认):`resolvePoRefs` 已能取到订单分录,可顺带读 `material_entity[].close_state`,
  **推送前拦截**并给出人话提示("该订单行在金蝶已关闭/已入库完毕,请清空采购订单号或先反关闭");
  或在收到「已关闭,不允许下推」时自动降级为不挂来源单重推一次。

## 复跑

```powershell
cd D:\YINJIA-main\tools
java -cp lib\mssql-jdbc.jar ..\tools\archive\_erp-closed-segment-20261111\Probe2.java HSDZ_MES
# 金蝶侧只读(需真实账套 outerInstanceId,本机 config 为沙箱 359220,故未能执行):
node tools\archive\_erp-closed-segment-20261111\_q-order-state.mjs YJ-20261103-01
```
