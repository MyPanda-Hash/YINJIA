SET NOCOUNT ON;
-- 用 Java 同款 SQL 验证 qc_insp 列已齐(业务员/供应商代码/部门/部门名称/数量)
BEGIN TRY
  DECLARE @n int;
  SELECT @n = COUNT(*) FROM qc_insp WHERE 单据编号 IS NOT NULL;
  SELECT N'qc_insp 头表列完整 ✓ (' + CAST(@n AS nvarchar) + N' 行)' AS r;
END TRY BEGIN CATCH SELECT N'头表: ' + ERROR_MESSAGE() AS r; END CATCH;
BEGIN TRY
  DECLARE @n2 int;
  SELECT @n2 = COUNT(*) FROM qc_insp_detail WHERE 型号 IS NOT NULL OR 数量 IS NOT NULL;
  SELECT N'qc_insp_detail 明细列完整 ✓ (' + CAST(@n2 AS nvarchar) + N' 行有型号/数量)' AS r;
END TRY BEGIN CATCH SELECT N'明细: ' + ERROR_MESSAGE() AS r; END CATCH;
-- syncInspFromSlRecv 的 UPDATE 语法验证(事务回滚不落库)
BEGIN TRY
  BEGIN TRAN;
  UPDATE t SET t.单据日期 = s.单据日期, t.业务员 = s.业务员, t.供应商代码 = s.供应商代码,
    t.供应商 = s.供应商, t.部门 = s.部门, t.部门名称 = s.部门名称, t.数量 = s.数量
  FROM qc_insp t JOIN sl_recv s ON s.单据编号 = t.单据编号
  WHERE t.单据编号 = N'__NO_SUCH__';
  ROLLBACK TRAN;
  SELECT N'syncInspFromSlRecv UPDATE 语法 ✓' AS r;
END TRY BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  SELECT N'UPDATE: ' + ERROR_MESSAGE() AS r;
END CATCH;
