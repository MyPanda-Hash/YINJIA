/* migrate-yj-field-dedup.sql — 清掉 yj_field 完全重复的登记行(库规范体检 07)
 *
 * 体检「07 完全重复的字段登记行」报 6 处,全在 **PURCHASE_IN(采购入库单)**:
 *   创建人编码 / 修改人编码 / 审核人编码 / 未结算金额本位币 / 付款方式编码 / 付款账户编码 各 2 行。
 * 重复登记会让列头/取数出现重复列(与 2026-10-16「库存状况表字段重复」同源),故**保留 MIN(id)**、删其余。
 * ⚠ 四单是**基线面板**:删行后 PURCHASE_IN 由 171 → 165 行 ⇒ 必须同批重取 dump + 重跑
 *   `node tools/archive/_gen-fourdoc-restore.mjs` 刷新基线,否则 FourDocAudit 会报「缺失 6」。
 * 幂等:第二次执行删除 0 行。两账套都执行。
 */
SET NOCOUNT ON;
GO
DECLARE @del int;
;WITH d AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY panel_code, col_name, label, place, seq, ISNULL(ref_field,N''),
         ISNULL(display_field,N''), data_type, hidden, visible ORDER BY id) AS rn
  FROM yj_field)
DELETE FROM d WHERE rn > 1;
SET @del = @@ROWCOUNT;
PRINT N'[去重] yj_field 删除重复登记行 ' + CAST(@del AS nvarchar(10)) + N' 行';
GO
DECLARE @bad int = 0;
DECLARE @c int = (SELECT COUNT(*) FROM (SELECT panel_code, col_name, label, place, seq FROM yj_field
                  GROUP BY panel_code, col_name, label, place, seq HAVING COUNT(*) > 1) t);
IF @c > 0 SET @bad = @bad + 1;
DECLARE @pin int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'PURCHASE_IN');
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:重复登记组 %d(应 0);PURCHASE_IN 字段 %d 行(应 165);不符项 %d 条', 10, 1, @dbn, @c, @pin, @bad);
IF @bad = 0 RAISERROR(N'[OK] yj_field 已无完全重复的登记行', 10, 1);
ELSE RAISERROR(N'[FAIL] 去重自检未过', 16, 1);
GO