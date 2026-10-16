# 切炭直销入库 · 取证探针（2026-10-16）

回答「切炭直销入库是什么、系统里到底有没有数据」的一次性只读取证。**不改任何数据。**

## 怎么跑

本机 `PATH` 上的 `java` 是 Java 8，跑不了源码模式；用 JDK 25（仓库约定的版本）：

```powershell
cd tools
& "C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe" "-Dstdout.encoding=UTF-8" -cp "lib\mssql-jdbc.jar" `
  SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10" `
  yinjia "Yinjia@2026" archive\_dualout-probe\_q-dualout.sql
```

（账号口径同 `DbSync.java` 默认：user `yinjia`，密码可用 `YINJIA_SQL_PASS` 覆盖。）

| 脚本 | 查什么（PRINT 段落号） |
|---|---|
| `_q-dualout.sql` | **A** `yj_field`(WO_REPORT) 字段登记（place/seq/可见性）；**B** 自建成品入库单头（`FI-*`）；**C** 成品入库单行（`FI-*` 或负数量=红字）；**D** 全部未作废报工行（`scjl`：工序/报工数量/`直销数量`/`post_no` 入库单号） |
| `_q-dualout2.sql` | **F2** 那张自建单有没有 `inh` 台账流水；**G** `form_flow_link` 的 `FINISH_IN` 占用链（来源面板是谁）；**H** 成品入库单来源构成（业务类型 × 单据状态）；**I** `inh` 各 `src` 段汇总 |

## 结论（正式库 `HSDZ_MES` 实测）

1. **`直销数量` 是报工单表格里的可填列**：`yj_field` id 13265，`place='query,detail'`、`seq=55`（紧随「报工数量」seq 50）、`visible=1 / hidden=0 / required=0`。
   佐证：`WO_REPORT` 的表头字段只登记了「单据编号（`报工单号`）/单据日期」两项，报工数量、工序、直销数量等全在 `query,detail`。
2. **这条链从未跑过真实业务**：`scjl` 未作废报工仅 **3 行**（`BG-2026-10-0044/46/47`，工单 `GD-2026-10-0007`，成型 161 / 切炭 161 / 组装 160，均已审核），**`直销数量` 全为 NULL** ⇒ 合计 0、有直销行数 0。
3. **`bd_finish_in` 里没有一张切炭直销单**：231 张已审核的是金蝶导入的「产品入库单」`CPRK-*`；唯一一张自建的 `FI-2026-09-0001`（2026-09-24，业务类型「产成品入库」，加工单号 `MO-2026-09-0002`，明细 1200 支 `S022-2 A+级烧结炭棒/滤芯`）**单据状态=草稿、从未审核**，`inh` 里**没有它的入库流水**。
4. **那张 `FI-2026-09-0001` 也不是直销链生成的**：它的 `form_flow_link` 是
   `source_panel_code='MANU_ORDER'`（生产加工单「生成产成品入库单」按钮）→ `FINISH_IN`，`ACTIVE`，2026-09-24 10:02:23 by admin。
   直销链的 link 来源面板是 `WO_REPORT` —— 库里 `target_panel_code='FINISH_IN'` 的链**只有上面这一条**。
5. `inh` 各段去向（未作废）：src 0 期初 31 行 / src 1 采购入库 849 行 / **src 2 产成品入库 807 行 1,100,895.8** / src 3 其他入库 16 行 —— 这些 `src=2` 流水来自金蝶导入单，不是 MES 生产链产出。

> 一句话：**代码在位（报工审核 → 自动建 `FINISH_IN` 并审核入账 + 弃审红字冲回）、E2E 脚本验证过，但正式库零真实数据**；
> 唯一那张自建成品入库单是另一条链（生产加工单按钮）的测试草稿。相关实现见
> `ButtonService.dualOutFinishIn` / `dualOutRedReverse`，流程位置见 `docs/design/生产流程-现役实现.md` §4.1。
