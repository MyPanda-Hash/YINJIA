# 验证:MES 采购入库单「一单多采购订单」能不能转 ERP(2026-11-13)

**结论:现在能 —— 端到端实测通过。** 一张采购入库单的明细行各带各的 `源单编号`,转ERP 后
金蝶侧**每一行都挂到自己的采购订单 + 订单行**上(单据 id / 分录 id 都对得上)。

## 一、实测证据(测试账套 × 金蝶测试沙箱)

| 步骤 | 结果 |
|---|---|
| 前置:沙箱采购订单 | `YJ-20260909-01`(供应商 `YJ-XWR`,行1 `YJ-XWR-003`,已审核)、本次新建并审核的 `CGDD-20261113-00001`(同供应商,行1 `YJ-XWR-031` / 100 / 个) |
| MES 建单(测试账套) | `PI-2026-11-0016`,头 `采购订单号` = `YJ-20260909-01、CGDD-20261113-00001`(多单串);行1 `源单编号=YJ-20260909-01` / 行2 `源单编号=CGDD-20261113-00001`,两行 `采购订单行号` 均为 1 |
| 审核 | 200 success |
| 点「转ERP」 | 200 success,回写 `ERP单号 = CGRK-20261113-00049` |
| **金蝶回读**(沙箱) | 单号 `CGRK-20261113-00049`,供应商 `YJ-XWR`,状态 `Z`(未审核,待金蝶人工审核) |
| ↳ 行1 | `YJ-XWR-003` qty 5 → **src_bill_no=`YJ-20260909-01`**,`src_seq=1`,`src_entry_id=2574926655462286336`,`src_inter_id=2574926653851550720` |
| ↳ 行2 | `YJ-XWR-031` qty 5 → **src_bill_no=`CGDD-20261113-00001`**,`src_seq=1`,`src_entry_id=2611838758575905794`,`src_inter_id=2611838755849485312` |
| 清理 | MES 单据已弃审+删除;沙箱入库单 `pur_bill_inbound` 已删、测试订单已弃审+删除 ⇒ 沙箱恢复 2 张订单 |

> 表头那条「订单1、订单2」多单串**没有被当成 src_bill_no 推出去**(逐行优先 + 多单串跳过),
> 这是本次能和不能的分水岭:`KingdeePushService` 650-688 行(`multiOrderHead` + `resolveLinePoRef`)。

## 二、跑之前必须知道的 4 个前提(缺一条就"推成功但挂不上")

1. **采购订单必须在目标金蝶账套里存在且已审核** —— 否则该行**静默不挂源单**(只记日志/提示),
   整单照样能推成功。
   ⚠ 上一轮 `_erp-clicktest-20261113` 的「7/7 全绿」只证明了"能推成功":我回读沙箱
   `CGRK-20261113-00047` / `-00048` 时**行上 src_bill_no 全空** —— 因为那两张测试单引用的
   MES 自造订单(`PO-2026-11-0013/0014`)在沙箱里根本不存在。**本次补上了"真挂上"的证据**。
2. **同一张入库单只能一个供应商** ⇒ 合单的多张采购订单必须**同供应商**。
3. **物料要与订单行一致**(金蝶按 `material_id` 比对),**数量不得超过订单行未入库量**(超额被拒)。
4. `采购订单行号` 必须是该订单里真实存在的 `seq`,否则该行只带 `src_bill_no` 不带 `src_seq`。

## 三、复跑

```powershell
# 前置:8090 后端在跑(当前 jar 含 PoLineRef 行级逻辑,2026-11-13 15:18 构建)+ 沙箱两张同供应商订单
# 1) 沙箱造第二张同供应商订单(一次性;已清理,复跑需重造)
#    见下方 node 片段(kingdee-client.mjs + kingdeePost)
# 2) MES 建单并转ERP
node tools/archive/_verify-multipo-erp-20261113/verify.mjs          # 建单(输出单据编号)
node tools/archive/_verify-multipo-erp-20261113/push-existing.mjs PI-2026-11-xxxx   # 审核+转ERP+回读
# 3) 金蝶回读:GET /jdy/v2/scm/pur_inbound?bill_no=<ERP单号> → /pur_inbound_detail 看 material_entity[].src_*
```

造单片段(沙箱,`deploy/push/config.json` 凭证 + `sandboxInstanceId` 当 outerInstanceId):

```js
const body = { bill_date: '2026-11-13', supplier_number: 'YJ-XWR', remark: '[MES-VERIFY] 多订单入库验证',
  material_entity: [{ material_number: 'YJ-XWR-031', qty: '100', price: '0.065', unit_id: '1' }] };
await kingdeePost(cfg, token, '/jdy/v2/scm/pur_order', {}, body);           // → CGDD-…
await kingdeePost(cfg, token, '/jdy/v2/sys/common_operate', {},
  { operate_type: 'audit', entity_number: 'pur_bill_order', ids: [newId] }); // 必须审核,否则挂不上
```

## 四、代码落点(本轮已确认在**运行中的 jar** 里)

- `KingdeePushService` 650-688:行级取 `源单编号`(兼容 `采购单号`)→ 每行 `resolveLinePoRef`
  (`src_bill_no`/`src_inter_id`/`src_entry_id` 各对各的),表头多单串(`、`/`,`)只作展示。
- `KingdeePushService$PoLineRef`(行级缓存)存在于 `backend/target/app.jar` → 运行实例即新逻辑。
- 链路上游把行级订单号写进入库行的是 `ButtonService`(4749-4751、5293-5318 落 `源单编号`)。
