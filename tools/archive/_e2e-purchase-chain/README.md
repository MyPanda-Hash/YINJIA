# 采购→入库全流程 E2E(真实登录回归)

> 一次可重跑的端到端回归:**真实登录取令牌 → 走真实 HTTP 接口 → 覆盖采购链每一种分流**。
> 断言既查接口返回,也查落库结果(单据状态 / 链路台账 / 库存总账与流水)。

| 项 | 值 |
|---|---|
| 执行时间 | 2026-10-09 10:29(最后一轮 73/73 PASS) |
| 被测实例 | `http://127.0.0.1:8090`(`java -jar yinjia-mes-backend-0.1.0.jar`,2026-10-09 09:30 构建) |
| 账套 | **`YJ_TEST`(HSDZ_MES_TEST 测试库)** —— 造数不污染正式账 HSDZ_MES |
| 账号 | `admin / 123456`(真实登录,非绕过鉴权) |
| 主脚本 | `_e2e-purchase-chain.cjs` |
| 结果 JSON | `_e2e-purchase-chain-result.json` |
| 控制台全文 | `_e2e-run-final.out` |

## 一、怎么跑

```powershell
# 前置:8090 后端在跑(tools\scripts\start-prod.ps1)
node tools\archive\_e2e-purchase-chain\_e2e-purchase-chain.cjs            # 默认 YJ_TEST 测试账套
node tools\archive\_e2e-purchase-chain\_e2e-purchase-chain.cjs YJ         # 换正式账套(会写入正式库,慎用)

# 独立验库(不依赖接口自证):把结果里那条完整链的单据号灌进 SQL 再查
node tools\archive\_e2e-purchase-chain\_v-gen-chain-sql.cjs
cd tools; $env:YINJIA_SQL_PASS='***'
java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" yinjia env archive\_e2e-purchase-chain\_v-chain.sql
java -cp lib\mssql-jdbc.jar SqlRunner.java "...;databaseName=HSDZ_MES_TEST;..." yinjia env archive\_e2e-purchase-chain\_v-stock.sql
java -cp lib\mssql-jdbc.jar SqlRunner.java "...;databaseName=HSDZ_MES_TEST;..." yinjia env archive\_e2e-purchase-chain\_v-link-gap.sql
```

退出码:0 = 全绿;1 = 有用例未过;2 = 脚本异常。

## 二、口径真源(断言依据的是代码,不是印象)

| 环节 | 真源 |
|---|---|
| 采购订单 → 送料暂收单 | `PanelConfigService.PUSH_TARGETS` = `PU_ORDER\|生成送料暂收单 → QC_RECV` |
| 暂收 → 检验 / 免检入库(**按行分流**) | `QcRecvGenerateHandler`:`bs_inv.来料检验='是'` → `QC_INSP`,其余(含空/档案查不到)→ `PURCHASE_IN` |
| 检验审核双出口 | `ButtonService.inspAutoPurchaseIn`(合格>0 → 入库,实收=合格数量)+ `inspAutoReturn`(不良>0 → 退回) |
| 退回 → 特采单 | `ButtonService.returnAutoSpecialAccept`:退料**明细行勾「特采」**,退料单审核/审批通过时逐行生成(一物料一单) |
| 特采单 → 入库 | `ButtonService.tcInApprovedGenerate`:恒为**二级批准**,全部数量入库、不走退料,行上 `特采=是` |
| 状态机 | 草稿→(审核)→已审核;草稿→提交审批→审批中→(一级)→待二级审批→(二级)→已审核(`ADMIN_L2_PANELS` 含 `QC_TC_IN`) |

## 三、覆盖矩阵(73 条用例)

| 场景 | 覆盖 | 关键断言 |
|---|---|---|
| **P0 登录鉴权** | 两账套真实登录 / 错口令 / 无令牌 | `factory=YJ_TEST`、`YJ` 均可登录;错口令 409「用户名或密码错误」;无令牌 403 |
| **P1 采购订单→暂收** | 草稿守卫、审核后生单、带入 | 草稿生单被拒「仅已审核单据可生单」;行/头/批次号/批次键带入一致 |
| **P2 免检直达** | 草稿守卫、去向、重复生单、过账 | 去向恒为 `PURCHASE_IN`(不产检验单);`是否来料检验=否`;重复生单拒;审核过账 |
| **P3 检验·全合格** | 单出口 | 生成入库单(实收=合格数量,`特采=否`);**不产空退回单**;检验行回填「入库单号」 |
| **P4 检验·全不合格** | 单出口 + 不特采 | 不产入库单;退回单退货数量=不合格数量、送检数量带走;退料审核(**未勾特采**)不产特采单 |
| **P5 特采全链(旗舰)** | 部分合格 → 双出口 → 勾特采 → 特采单 → 两级审批 → 入库 | 特采单总数量=`送检数量+单位`(100升)、不合格品数量=退货数量(40)、比例 40%、批次号随链继承;未提交直接审批被拒;一级通过**不**生单、二级批准才生单;特采入库行 `实收=100 / 特采=是 / 是否来料检验=是` |
| **P6 混合分流** | 一单两行(一免检一走检验)+ 检验单两行(一合格一不良) | 暂收单一次生单产出**两张**下游单且不串行;同一检验单同时产出入库单(40)+退回单(30);回填只给合格行 |
| **P7 弃审级联** | 下游已审核挡弃审 / 草稿联动作废 | 入库单已审核 → 弃审检验单被拒;弃审后入库单草稿作废 + 回填清空;特采单已审核 → 弃审退料单被拒;逐级弃审逐级作废 |
| **P8 边界** | 手工特采单、0/0 检验、停用仓库 | 无来源链路的特采单批准后**不**凭空入库;合格=0 且不良=0 两个出口都不产空单;停用仓库单据可建可生单、审核过账被拦且整笔回滚 |
| **P9 另一条路径** | 提交审批→审批通过路径、多行特采、驳回重提、守恒守卫 | 检验单走审批路径同样自动双出口;退料两行勾特采 → **两张**特采单(100升/60升,各 100%);特采单驳回回草稿可重提;送检数量为空时「合格+不合格超量」被拒;特采比例非整数 66.7% |

## 四、独立验库结论(不靠接口自证)

链路台账 `form_flow_link`(PO-2026-10-0051 那条完整链,全 `ACTIVE`):

```
PU_ORDER  PO-2026-10-0051 ─100─▶ QC_RECV  SL-2026-10-0171
QC_RECV   SL-2026-10-0171 ─100─▶ QC_INSP  IJ-2026-10-0096
QC_INSP   IJ-2026-10-0096 ─ 60─▶ PURCHASE_IN PI-2026-10-0085   (合格)
QC_INSP   IJ-2026-10-0096 ─ 40─▶ QC_RETURN   TH-2026-10-0042   (不良)
QC_RETURN TH-2026-10-0042 ─100─▶ QC_TC_IN    TCI-2026-10-0057   (送检数量)
QC_TC_IN  TCI-2026-10-0057 ─100─▶ PURCHASE_IN PI-2026-10-0086   (特采全量入库)
```

- **数量守恒**:采购 100 = 送检 100 = 合格 60 + 不合格 40;入库 60 + 退回 40 = 100;特采 100 全量入库。
- **特采标记**:`bl_purchase_in` 上 `PI-0086 特采=是`、`PI-2026-10-0083/0084/0085 特采=否`;`是否来料检验` 免检物料为「否」、其余为「是」。
- **批次号**:`sl_recv / qc_insp / qc_return / qc_tc_in / bd_purchase_in` 五单同为 `20261009`,逐站继承。
- **库存记账**:`inh` 三张已审核入库单流水各 1 行(50×4=200 / 100×10=1000 / 100×10=1000),流水合计 250 = 单据合计 250;`kucun` 结存同步更新。
- **无来源特采单**:`TCI-2026-10-0059` 的 `检验单号/暂收退料单号` 均为 NULL,批准后未产生任何入库单。
- **停用仓库负向用例**:`PI-2026-10-0087`(仓库=原料仓,已停用)审核被拒,单据停在草稿、未产生流水。

原始输出:`_v-chain.out`、`_v-stock.out`(与 `_v-link-gap.sql` 合并输出)、`_e2e-run-final.out`。

## 五、发现(本轮新查出,尚未修复)

1. **特采链末跳 `form_flow_link.batch_no` 留空 → 按批次号反查链路会漏这一跳**(轻微,数据完整性)
   - 证据:`_v-link-gap.sql` 输出 —— 同一批次键下 6 行链路全中;按 `batch_no` 反查命中 211 行,**其中特采入库跳 0 行**。
   - 根因:`ButtonService.tcInApprovedGenerate` 写 `form_flow_link` 时**只给了 `batch_id`、没给 `batch_no`**
     (`INSERT ... source_quantity, linked_quantity, batch_id, link_status ...`),而其余各跳都写了 `batch_no`。
   - 旁证:`PushGenerateHandler` 特意补过一句 `UPDATE form_flow_link SET batch_no=? WHERE batch_id=? AND ISNULL(batch_no,N'')=N''`,
     注释写明「batch_no 一直留空会让『按批次反查链路』少一条线索」—— 但那条兜底只跑推式生单路径,特采单这条路不经过它。
   - 影响面:`BatchService.docsOfBatch`(`WHERE batch_no=?`)按批次号反查会漏掉特采入库单;按 `batch_id` 广搜不受影响。

2. **特采单「总数量兜底」分支新单不可达**(非缺陷,仅口径澄清)
   - `returnAutoSpecialAccept` 在退料行「送检数量」为空时按「退货数量」兜底;但检验单保存有数量守恒守卫
     (用例 P9.4:送检数量为空 + 不合格 45 → 被拒「合格数量(0)+不合格数量(45) 超过送检数量(0)」),
     因此**新单走不到这条分支**,它只服务 2026-10-04 之前的存量老单。代码注释与此一致,属预期。

## 六、过程中踩到的坑(供下次直接引用)

- **采购链的「仓库」存的是仓库名称,不是编码**。暂收/检验/入库一路继承的是名称;`StockLedgerService.resolveWh`
  编码优先、名称兜底,两者都不在启用态 `bs_wh` 里就抛「仓库档案不存在:[X]」。
  测试里若传 `CK01`(那是**编码**且该仓已停用),入库单能建能生单、直到审核过账才报错。
- 测试库 `bs_wh` 中 `CK01~CK05`(**原料仓/辅料仓/成品仓/半成品仓/不良品仓**)状态均为「停用」,
  启用中的是 `CK00006 华北工控仓 / YCL-01 恒亿仓 / CK00003 成品不良品区 / CK00005 原料不良品仓 / YJ-08 车间仓 / CP-02 成品B仓`。
- 走检验 / 免检由 `bs_inv.来料检验` 决定:测试库 3849 条非「是」、10 条「是」(`CL004`、`YJ-TJHZ-*`、`YJ-XH-001`)。
- 用 `SqlRunner.java` 跑 SQL 时,控制台中文要 `JAVA_TOOL_OPTIONS=-Dstdout.encoding=UTF-8`(否则 PRINT/结果乱码);
  本机 `sqlcmd`(ODBC 17)默认强制加密,连不上,直接用 `SqlRunner`。

## 七、目录内文件

| 文件 | 说明 |
|---|---|
| `_e2e-purchase-chain.cjs` | 主回归脚本(P0–P9,73 条用例) |
| `_e2e-purchase-chain-result.json` | 本轮逐步结果 + 全部单据号 |
| `_e2e-run-final.out` | 最后一轮控制台全文 |
| `_v-gen-chain-sql.cjs` → `_v-chain.sql` | 由结果生成验库 SQL(链台账/数量守恒/批次号/单据状态) |
| `_v-chain.out` / `_v-stock.out` | 对应的验库原始输出 |
| `_v-stock.sql` | 库存总账与流水核对 |
| `_v-link-gap.sql` | 「按批次号反查漏末跳」取证 |
| `_q-schema-probe.sql` / `_q-e2e-inputs.sql` / `_q-uom.sql` / `_q-wh.sql` / `_q-cols.sql` | 前置侦查(列/面板/必填/单位/仓库口径) |
| `_e2e-probe-chain.cjs` / `_e2e-probe-tc.cjs` / `_e2e-probe-desc.cjs` / `_e2e-probe-9-4.cjs` | 侦查脚本(确定标签与返回结构、定位 P9.4 失败原因) |
