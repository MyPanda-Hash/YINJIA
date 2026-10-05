/* ============================================================================
 * migrate-calc-amount-fill-2026-10-05.sql
 *   采购链/销售链「明细自动计算列」历史空值回填(用户口径:**只补空,不动任何已有值**)
 * ----------------------------------------------------------------------------
 * 背景(用户 2026-10-05:「采购入库单的金额要自动计算。并且整个链路有关自动计算的字段
 * 都要检验,是否有自动计算」):
 *
 *   自动计算规则本身早在 backend PanelConfigService.buildCalcRules 里就有,但它**只被前端
 *   消费** —— PanelxList.calculateDetailRow 挂在明细单元格 @change 上,只有"人手改一格"才触发;
 *   **生单与保存两条落库路径从来不重算**。于是:
 *     · 来料检验单审核自动生成采购入库单(ButtonService.inspAutoPurchaseIn)只写 实收数量/单价,
 *       金额留空 —— 实测 bl_purchase_in 269 行有量有价,**128 行金额为空**;
 *     · 分批送料把上游采购订单的**整单金额**原样带到暂收行(sl_recv_detail 226 行有量有价,
 *       160 行 金额 ≠ 数量×单价)。
 *
 *   代码侧已修(新增 CalcRuleService,ButtonService.upsertLineRows 在落库前逐行重算,
 *   与前端下发的 detail.tabs[].calc 同一份规则),所以**今后不会再产生新的空值**;
 *   本脚本只负责把**已经躺在库里**的空值补上。
 *
 * 口径(2026-10-05 用户拍板):
 *   ★ **只补空**:仅当目标列 IS NULL、且它的入参齐备时才写;任何**已有值一律不动** ——
 *     包括 sl_recv_detail 那 160 行"金额≠数量×单价"(它们要按第 2 条口径整体重算才动,
 *     不属于本次授权范围,见文末「未处理项」)。
 *   ★ 求值口径与 CalcRuleService 逐条一致:金额=数量×单价、含税单价=单价×(1+税率%/100)、
 *     含税金额=数量×含税单价、税额=金额×税率%/100、损耗率=损耗/送检数量;
 *     四舍五入到列的小数位(decimal(18,4))。
 *
 * 幂等:全部是 `SET 列 = 表达式 WHERE 列 IS NULL AND 入参齐备`;重跑第二次影响 0 行。
 * 两个账套都要跑(AGENTS.md 两账套纪律):先 HSDZ_MES,后 HSDZ_MES_TEST。
 * 用法(在 tools 目录):
 *   set YINJIA_SQL_PASS=<口令>
 *   java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env migrate-calc-amount-fill-2026-10-05.sql
 * ============================================================================ */

SET NOCOUNT ON;
PRINT N'== migrate-calc-amount-fill-2026-10-05 开始 ==';

/* 逐列的补空帮手:一次只补一列,表达式自带"入参齐备"守卫(不入参就 0 行)。
 * 用动态 SQL 是因为表/列在别的账套上可能缺(测试库结构陈旧),COL_LENGTH 先探。 */
DECLARE @sql nvarchar(max), @n int, @total int = 0;

/* ---------- ① 采购入库单(本任务的正主) ---------- */
-- 金额 = 实收数量 × 单价
IF COL_LENGTH('dbo.bl_purchase_in', N'金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_purchase_in SET [金额] = CAST([单价] * [实收数量] AS decimal(18,4))
              WHERE [金额] IS NULL AND [单价] IS NOT NULL AND [实收数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购入库行·金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
-- 含税单价 = 单价 × (1 + 税率%/100)
IF COL_LENGTH('dbo.bl_purchase_in', N'含税单价') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_purchase_in SET [含税单价] = CAST([单价] * (1 + ISNULL([税率%],0)/100) AS decimal(18,4))
              WHERE [含税单价] IS NULL AND [单价] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购入库行·含税单价 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
-- 含税金额 = 实收数量 × 含税单价(上一条刚把含税单价补齐,这里吃到新值)
IF COL_LENGTH('dbo.bl_purchase_in', N'含税金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_purchase_in SET [含税金额] = CAST([含税单价] * [实收数量] AS decimal(18,4))
              WHERE [含税金额] IS NULL AND [含税单价] IS NOT NULL AND [实收数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购入库行·含税金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

/* ---------- ② 送料暂收单(采购链上游;本次实测无空值,列在此处保证口径完整) ---------- */
IF COL_LENGTH('dbo.sl_recv_detail', N'金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.sl_recv_detail SET [金额] = CAST([单价] * [数量] AS decimal(18,4))
              WHERE [金额] IS NULL AND [单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  送料暂收行·金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.sl_recv_detail', N'含税单价') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.sl_recv_detail SET [含税单价] = CAST([单价] * (1 + ISNULL([税率%],0)/100) AS decimal(18,4))
              WHERE [含税单价] IS NULL AND [单价] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  送料暂收行·含税单价 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.sl_recv_detail', N'含税金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.sl_recv_detail SET [含税金额] = CAST([含税单价] * [数量] AS decimal(18,4))
              WHERE [含税金额] IS NULL AND [含税单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  送料暂收行·含税金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.sl_recv_detail', N'税额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.sl_recv_detail SET [税额] = CAST([金额] * ISNULL([税率%],0)/100 AS decimal(18,4))
              WHERE [税额] IS NULL AND [金额] IS NOT NULL AND [税率%] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  送料暂收行·税额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.sl_recv_detail', N'折扣金额') IS NOT NULL AND COL_LENGTH('dbo.sl_recv_detail', N'折扣%') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.sl_recv_detail SET [折扣金额] = CAST([数量] * [单价] * ISNULL([折扣%],0)/100 AS decimal(18,4))
              WHERE [折扣金额] IS NULL AND [数量] IS NOT NULL AND [单价] IS NOT NULL AND [折扣%] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  送料暂收行·折扣金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

/* ---------- ③ 采购订单(链头;本次实测 0 空值) ---------- */
IF COL_LENGTH('dbo.bl_pu_order', N'金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_order SET [金额] = CAST([单价] * [数量] AS decimal(18,4))
              WHERE [金额] IS NULL AND [单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购订单行·金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_pu_order', N'含税单价') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_order SET [含税单价] = CAST([单价] * (1 + ISNULL([税率%],0)/100) AS decimal(18,4))
              WHERE [含税单价] IS NULL AND [单价] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购订单行·含税单价 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_pu_order', N'含税金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_order SET [含税金额] = CAST([含税单价] * [数量] AS decimal(18,4))
              WHERE [含税金额] IS NULL AND [含税单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购订单行·含税金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_pu_order', N'税额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_order SET [税额] = CAST([金额] * ISNULL([税率%],0)/100 AS decimal(18,4))
              WHERE [税额] IS NULL AND [金额] IS NOT NULL AND [税率%] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购订单行·税额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_pu_order', N'折扣金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_order SET [折扣金额] = CAST([数量] * [单价] * ISNULL([折扣%],0)/100 AS decimal(18,4))
              WHERE [折扣金额] IS NULL AND [数量] IS NOT NULL AND [单价] IS NOT NULL AND [折扣%] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  采购订单行·折扣金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

/* ---------- ④ 请购单 ---------- */
IF COL_LENGTH('dbo.bl_pu_req', N'金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_req SET [金额] = CAST([单价] * [数量] AS decimal(18,4))
              WHERE [金额] IS NULL AND [单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  请购行·金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_pu_req', N'含税单价') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_req SET [含税单价] = CAST([单价] * (1 + ISNULL([税率%],0)/100) AS decimal(18,4))
              WHERE [含税单价] IS NULL AND [单价] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  请购行·含税单价 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_pu_req', N'含税金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_pu_req SET [含税金额] = CAST([含税单价] * [数量] AS decimal(18,4))
              WHERE [含税金额] IS NULL AND [含税单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  请购行·含税金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

/* ---------- ⑤ 销售出库单(列名是 售价/销售金额/含税销售金额,与采购侧不同名) ---------- */
IF COL_LENGTH('dbo.bl_sale_out', N'销售金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_sale_out SET [销售金额] = CAST([售价] * [数量] AS decimal(18,4))
              WHERE [销售金额] IS NULL AND [售价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售出库行·销售金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_sale_out', N'含税售价') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_sale_out SET [含税售价] = CAST([售价] * (1 + ISNULL([税率%],0)/100) AS decimal(18,4))
              WHERE [含税售价] IS NULL AND [售价] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售出库行·含税售价 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_sale_out', N'含税销售金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_sale_out SET [含税销售金额] = CAST([含税售价] * [数量] AS decimal(18,4))
              WHERE [含税销售金额] IS NULL AND [含税售价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售出库行·含税销售金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_sale_out', N'税额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_sale_out SET [税额] = CAST([销售金额] * ISNULL([税率%],0)/100 AS decimal(18,4))
              WHERE [税额] IS NULL AND [销售金额] IS NOT NULL AND [税率%] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售出库行·税额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

/* ---------- ⑥ 销售订单 ---------- */
IF COL_LENGTH('dbo.bl_so_order', N'金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_so_order SET [金额] = CAST([单价] * [数量] AS decimal(18,4))
              WHERE [金额] IS NULL AND [单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售订单行·金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_so_order', N'含税单价') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_so_order SET [含税单价] = CAST([单价] * (1 + ISNULL([税率%],0)/100) AS decimal(18,4))
              WHERE [含税单价] IS NULL AND [单价] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售订单行·含税单价 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_so_order', N'含税金额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_so_order SET [含税金额] = CAST([含税单价] * [数量] AS decimal(18,4))
              WHERE [含税金额] IS NULL AND [含税单价] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售订单行·含税金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END
IF COL_LENGTH('dbo.bl_so_order', N'税额') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_so_order SET [税额] = CAST([金额] * ISNULL([税率%],0)/100 AS decimal(18,4))
              WHERE [税额] IS NULL AND [金额] IS NOT NULL AND [税率%] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  销售订单行·税额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

/* ---------- ⑦ 库存出入库一族:金额 = 数量 × 单价 ---------- */
DECLARE @tbl sysname, @qty sysname;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT * FROM (VALUES
    (N'bl_finish_in',        N'实收数量'),
    (N'bl_other_in',         N'数量'),
    (N'bl_other_out',        N'数量'),
    (N'bl_material_out',     N'数量'),
    (N'bl_outsource_in',     N'实收数量'),
    (N'bl_outsource_issue',  N'数量'),
    (N'bl_manu_order',       N'数量')
  ) AS t(tbl, qty);
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @qty;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('dbo.' + @tbl, N'金额') IS NOT NULL
     AND COL_LENGTH('dbo.' + @tbl, N'单价') IS NOT NULL
     AND COL_LENGTH('dbo.' + @tbl, @qty) IS NOT NULL
  BEGIN
    SET @sql = N'UPDATE dbo.' + QUOTENAME(@tbl) + N' SET [金额] = CAST([单价] * ' + QUOTENAME(@qty) + N' AS decimal(18,4))
                WHERE [金额] IS NULL AND [单价] IS NOT NULL AND ' + QUOTENAME(@qty) + N' IS NOT NULL';
    EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
    PRINT N'  ' + @tbl + N'·金额 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
  END
  FETCH NEXT FROM cur INTO @tbl, @qty;
END
CLOSE cur; DEALLOCATE cur;

/* ---------- ⑧ 生产工单:总重 = 单重 × 数量 ---------- */
IF COL_LENGTH('dbo.bl_manu_order', N'总重') IS NOT NULL AND COL_LENGTH('dbo.bl_manu_order', N'单重') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.bl_manu_order SET [总重] = CAST([单重] * [数量] AS decimal(18,4))
              WHERE [总重] IS NULL AND [单重] IS NOT NULL AND [数量] IS NOT NULL';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  生产工单行·总重 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

/* ---------- ⑨ 来料检验单:损耗率 = 损耗 / 送检数量(列注释口径,按 0~1 小数存) ---------- */
IF COL_LENGTH('dbo.qc_insp_detail', N'损耗率') IS NOT NULL
BEGIN
  SET @sql = N'UPDATE dbo.qc_insp_detail SET [损耗率] = CAST([损耗] / [送检数量] AS decimal(18,4))
              WHERE [损耗率] IS NULL AND [损耗] IS NOT NULL AND [送检数量] IS NOT NULL AND [送检数量] <> 0';
  EXEC sp_executesql @sql; SET @n = @@ROWCOUNT; SET @total += @n;
  PRINT N'  来料检验行·损耗率 补空: ' + CAST(@n AS nvarchar(10)) + N' 行';
END

PRINT N'== 本次共补空 ' + CAST(@total AS nvarchar(10)) + N' 行(已有值一律未动)==';
PRINT N'== migrate-calc-amount-fill-2026-10-05 完成 ==';
GO
