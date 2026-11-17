# 采购入库单「一行拆多个仓库」取证包(2026-11-17)

## 一、客户口径(原话)

> 「还有采购入库单在草稿状态下要可以实现一个明细划分多个仓库来存放」

确认做法时选了「**直接把明细拆成多条行**」,并补一句:

> 「但是来源采购订单行号和上游的行号不变。」

数量口径选:「**各仓库合计 = 该行实收数量**」。

## 二、改了什么

| 位置 | 内容 |
|---|---|
| `backend/.../service/PurInSplitService.java`(新增) | 拆行事务:守草稿/未转ERP/未作废 → 校验仓库与数量 → 第一行就地改、其余行 `INSERT…OUTPUT INSERTED.id` 原样复制 → 金额族按数量占比分摊(尾差落最后一行) → 占用链 `form_flow_link` 一起拆 |
| `backend/.../controller/PxController.java` | 新端点 `POST /api/px/purIn/split`(权限词 = PURCHASE_IN 的「修改」) |
| `frontend/src/core/panel/purInSplit.js`(新增) | 纯函数:默认分配(原仓全量 + 空仓)、合计/差额、校验(2 行起、必选仓库、数量>0、合计相等，容差 0.00005)、提交清单收口 |
| `frontend/src/core/views/PurInSplitDialog.vue`(新增) | 拆分弹窗:仓库/仓位下拉(档案)、数量、实时合计与差额,差额≠0 时「确定拆分」不可点 |
| `frontend/src/core/views/PanelxForm.vue` | 明细「操作」列加拆分图标,**只对 PURCHASE_IN 且草稿可编辑**;未落库的行提示「先保存」;拆完重载单据 |
| `frontend/src/business/engine.js` / `core/panel-runtime.js` | `splitPurInLine` → `POST /px/purIn/split` |
| 10 个语言包 | 新增 16 条词条(拆分仓库/采购订单行号/差额/确定拆分/各类校验文案…) |

## 三、验证(测试库 HSDZ_MES_TEST,ego 浏览器)

单据 **PI-2026-11-0002**(草稿、未转ERP、5 行、带 5 条 QC_RECV 占用链),把第 1 行(YJ-SX-068,实收 6200,金额 2976)拆成
**恒亿仓 4000 + 成品B仓 2200**:

| 检查项 | 结果 |
|---|---|
| 拆完行数 | 5 → 6(原行 id 1241 保留 + 新行 id 1268) |
| 数量 | 1241=4000、1268=2200,合计 6200 = 原实收数量 ✅ |
| 金额 | 1920 + 1056 = 2976(与原行一字不差)✅ |
| **来源采购订单行号** | 两行都是 `源单行号=1`(客户点名的那条)✅ |
| 批次号 / 批号 | 两行均 `YJ-20260916-01-001`,一字未改 ✅ |
| 占用链 | 原链 2061 → 4000;新增 2116(source_line_key 同为 `SL-2026-09-0021#41`)→ 2200,合计 6200 不变 ✅ |
| 审核 → 记账 | `kucun`:YJ-SX-068 @ **YCL-01** 4000 / @ **CP-02** 2200,两条独立台账行 ✅ |
| 弃审 → 冲回 | 两条台账行对称归零 ✅ |
| 守卫(实测接口) | 只给一个仓库 → 409「至少要分到两个仓库」;合计 6000≠6200 → 409 带差额;仓库不存在 → 409 点名;已作废(`yj_doc_status.canceled=Y`)→ 409(见下) |

截图(`screenshots/`,png 被 .gitignore 忽略,本机 `C:/Users/Lenovo/ego/purinsplit-20261117/`):
`s2-form.png` 草稿单明细(每行一个绿色拆分图标)、`s6-dialog-ready.png` 拆分弹窗填好两仓(差额 0)、
`s10-after-split.png` 拆完 6 行、`s11-audit.png` 审核后状态。

## 四、踩到的两个坑(已修,留档)

1. **varbinary → datetime2 隐式转换**:最初用「逐列 `setObject`/`setNull(Types.NULL)` 复制近 100 列」,
   SQL Server 把 NULL 当二进制下发,撞 `datetime2` 列直接 500。
   改成 `INSERT INTO t (cols) OUTPUT INSERTED.id SELECT cols FROM t WHERE id=?`,
   只有要改写的那十几列用 `update(sql, args, types)` 带类型绑定。
2. **只看单头「单据状态」不够**:作废单的 `bd_purchase_in.单据状态` 仍写着「草稿」,
   真正的状态在 `yj_doc_status`(canceled/deleting)。已补守卫并实测 409。
3. 顺手留了 `_Probe.java`:打印一行所有列的 JDBC 类型/Java 类(排查类型问题的入口)。

## 五、测试数据改动(测试库,已尽量还原)

- `PI-2026-11-0002`:第 1 行已拆成两仓并**完成一次审核 + 弃审**(验证记账与冲回),现为草稿、6 行;
  其余 4 行补了 `仓库=恒亿仓/YCL-01`(不补则审核会因「仓库为空」过不了)。
- `PI-2026-11-0016`:守卫实测时误拆过一次(当时程序还没查 `yj_doc_status`),**已还原**
  (1263 数量/金额改回 5/1.95、删掉多出的 1269 行),该单本来就是作废单。
- 正式库 `HSDZ_MES` 未做任何写操作。
