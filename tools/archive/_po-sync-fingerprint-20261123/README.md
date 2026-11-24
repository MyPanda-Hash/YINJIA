# 采购订单「金蝶改了明细、MES 没跟上」取证(2026-11-23)

> 报障原话:「为什么金蝶的采购订单,在 mes 上没有同步」(附金蝶与 MES 同单截图)。
> 结论:**不是没同步,是被「无变化跳过」永久跳过**。采样单 `YJ-20261117-01`。

## 一、实测事实

| | 金蝶(pur_order / pur_order_detail) | 生产 MES(36.140.66.163:8090) |
|---|---|---|
| 单据状态 | `bill_status=C` | 已审核 |
| 审核人 / 审核时间 | 冯加劲 / **2026-11-23 14:03:53** | 冯加劲 / **2026-11-19 15:28:52(旧)** |
| 明细 | MG-12 **100** / MG-2050 15 / **SD-2050 70(3 行)** | MG-12 **50** / MG-2050 15(**2 行**) |
| 金额 | 4600 / 1500 / 28000 | 2300 / 1500 |

同步任务**是活的**:金蝶「已审核 + 近 10 天」77 张在 MES 全部在册(缺 0);近 31 天窗口内 168 张逐张比对,
**只有这 1 张**明细不一致 —— 说明触发条件是「**只改了分录、没改表头**」。

## 二、根因(两段叠加,第二段是根本)

1. 增量列表固定带 `bill_status=C`(`deploy/sync-core.mjs` 的 listParams)⇒ 弃审期间该单从列表消失,同步看不到。
2. **判重靠「列表行指纹」,而订单列表接口看不见明细**:
   `pur_order` 列表行实测**只有 18 个键**——`create_time / bill_date / id / bill_no / bill_status /
   bill_close_state / supplier_* / emp_* / remark / io_status / real_io_status / delivery_type_*`,
   **没有数量、金额、明细行、修改时间、审核时间**;而 `PU_ORDER.fingerprintOf` 恰好取其中 9 项。
   「弃审 → 改分录 → 重审」后这 9 项**一模一样**(票据状态仍 C、关闭状态仍 C、单据日期/供应商/业务员/备注都没动),
   ⇒ 每轮都判「无变化跳过」,详情接口根本不调,明细永远不重写。
3. `init-sync.mjs`(月度复核)**也不强制刷新**(强制只认 `--refresh=`),所以月度兜底同样修不好。

`probe-4-fingerprint.mjs` 的实测输出(金蝶列表行 vs MES 库里那行):

```
bill_close_state   = "C"            | 关闭状态 = "C"            OK
bill_date          = "2026-11-17"   | 单据日期 = "2026-11-17"   OK
supplier_name      = "山东鑫永恒…"  | 供应商   = "山东鑫永恒…"  OK
supplier_number    = "YJ-SDXYH"     | 供应商编码 = "YJ-SDXYH"   OK
emp_name           = "孙淼淼"       | 业务员名称 = "孙淼淼"     OK
io_status          = "A"            | 入库状态 = "A"            OK
remark             = ""             | 备注 = ""                 OK
```

修好后本机账套落库的指纹(与上面 9 项逐字一致,只多了今日戳):

```
C|C|2026-11-17|山东鑫永恒新材料有限公司|YJ-SDXYH|孙淼淼|A|A||D2026-11-23
```

## 三、修法(已实现,`deploy/sync-core.mjs` / `deploy/sync.mjs`)

- 增量模式下**订单**指纹追加当日戳 `|Dyyyy-MM-dd`(`orderDailyStampOnly`)⇒ 每天第一轮把窗口内订单
  (当前约 170 张、详情节流 120 ms ≈ 40 s)重取一次详情,同日第二轮起命中同一指纹即跳过。
- 新增 `--refresh-bill=<单号[,单号]>`:点名单张强制重取(不在列表里的单号会按 `bill_no` 单独补查一次)。

验收(本机 `HSDZ_MES`,只同步 `PU_ORDER`):

```
第一轮:明细每日复核 168 张 → 待写入 168 → 新增 33 / 更新 135 / 失败 0;库内带今日戳 168 行
第二轮:待写入 5(真变化)/ 无变化跳过 163          ← 同日幂等,没有每轮重写风暴
--refresh-bill=YJ-20261117-01:点名命中 1 张 → 待写入 1 → 更新 1
落库结果:审核时间 2026-11-23 14:03:53,MG-12 100 / MG-2050 15 / SD-2050 70(3 行)
```

## 四、探针(均可复跑;只读,除 probe-5 只查库)

```powershell
# 金蝶侧:这张单现在是什么样(列表 + 详情,含 audit_time / 分录)
node tools/archive/_po-sync-fingerprint-20261123/probe-1-kingdee-order.mjs YJ-20261117-01

# 生产 MES:同单的头 + 明细(admin/123456,可用 MES_USER / MES_PASS 覆盖)
node tools/archive/_po-sync-fingerprint-20261123/probe-2-mes-order.mjs PU_ORDER YJ-20261117-01

# 全量复核:金蝶窗口内 N 张 × 生产 MES,逐张比「行:数量」与审核时间(约 5 分钟)
node tools/archive/_po-sync-fingerprint-20261123/probe-3-full-compare.mjs

# 指纹比对证明(金蝶列表行 vs MES 库里那行)
node tools/archive/_po-sync-fingerprint-20261123/probe-4-fingerprint.mjs YJ-20261117-01

# 本机账套:某单落库后的头 + 明细(验证补同步结果)
node tools/archive/_po-sync-fingerprint-20261123/probe-5-verify-local-row.mjs YJ-20261117-01
```

注:`probe-1/3/4` 走金蝶开放平台,本机需带系统代理(`NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY`)。
