# 采购链行级采购订单号取证（2026-11-13）

用户口径：见 `docs/development/采购链行级采购订单号-全链贯通.md` 开头引用的原话。

## 结论速查

| 站点 | 行级订单号列 | 验证 |
|---|---|---|
| 送料暂收 QC_RECV | 采购单号 | `round-04.json` → `po → 暂收行 采购单号 = PO-2026-11-0014` |
| 来料检验 QC_INSP | 采购单号 | 同上（保存 送检/合格/不合格 后仍保留） |
| 暂收退回 QC_RETURN | 采购单号 + 采购订单行号 | 同上（`采购订单行号=1`、`退货数量=40`） |
| 特采 QC_TC_IN | **表头** 采购单号（该单只有表头） | 同上（`TCI-2026-11-0004`，两级审批到已审核） |
| 采购入库 PURCHASE_IN | **源单编号**（金蝶 src_bill_no 同名） | 同上（合格 60 / 特采 40 两张，均 `源单编号=PO-2026-11-0014`） |

转ERP：`KingdeePushService` 逐行取 `源单编号` 解析 `src_bill_no/src_seq`；表头多单串显式跳过（代码见
`KingdeePushService` 的 `multiOrderHead` 与 `resolveLinePoRef`，单测 `frontend/src/core/views/chainPoNo.test.js` ③）。

退货回冲：`BatchService.returnedByOrderLine` 改为行级 `采购单号` 优先 + 表头兜底 —— `round-04.json` 的
`cap = {已退回:40, 剩余:40, 可送上限:45}` 就是它生效的证据（改造前该值为 0）。

## 脚本

| 文件 | 用途 |
|---|---|
| `ProbeChainPoNo.java` / `Q.java` / `Q2.java` / `Q3.java` | 只读取证：各站明细/表头有哪几列、yj_field 登记与可见性、存量有值行数 |
| `round-01.mjs` | 首轮全链（发现"手工 API 保存不带 readonly 字段会把行级单号清空"的测试假象 + 特采需两级审批） |
| `round-02.mjs` | 半程（订单→暂收→检验→退回）留档排查 |
| `round-03.mjs` | 全链（检验/退回保存时整行回传，与界面提交一致）+ 特采两级审批 |
| `round-04.mjs` | **最终验收**：采购订单带 `行号`，全链 + 特采两级审批 + 退货回冲额度，跑完即删 |

复跑（需 8090 + 5173；脚本自己切测试库，不是测试库直接拒绝）：

```powershell
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_chain-pono-20261113/round-04.mjs')"
```

⚠ 造数清理：`round-0*.json` 的 `cleanup` 全是 `删除=200`（PI/TC/TH/IJ/SL/PO 逐张弃审+删除）。

⚠ 本机 ego 浏览器 `Page.captureScreenshot` 一直 CDP 超时，故证据为接口原文，无截图。
