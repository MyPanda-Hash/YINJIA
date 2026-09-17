SET NOCOUNT ON;
DECLARE @r nvarchar(max) = N'';
-- ① syncInspFromSlRecv 行级同步 UPDATE(ButtonService.java:405)
BEGIN TRY
  BEGIN TRAN;
  UPDATE d SET d.物料编码 = s.物料编码, d.物料名称 = s.物料名称, d.型号 = s.型号,
    d.物料描述 = s.物料描述, d.数量 = s.数量, d.箱数 = s.箱数, d.日期 = s.日期,
    d.备注 = s.备注, d.结案 = s.结案, d.部门 = s.部门, d.部门名称 = s.部门名称
  FROM qc_insp_detail d JOIN sl_recv_detail s ON s.id = -1
  WHERE d.id = -1 AND d.单据编号 = N'__X__' AND ISNULL(d.asp_cancel, 'N') <> 'Y';
  ROLLBACK TRAN; SET @r += N'①行级同步UPDATE ✓ ';
END TRY BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRAN; SET @r += N'①✗ ' + ERROR_MESSAGE() + N' | '; END CATCH;
-- ② 生采购入库 SELECT(:1313)
BEGIN TRY
  SELECT id, 物料编码, 物料名称, 型号, 数量, 合格数量, 仓库代码 FROM qc_insp_detail WHERE 1=0;
  SET @r += N'②生入库SELECT ✓ ';
END TRY BEGIN CATCH SET @r += N'②✗ ' + ERROR_MESSAGE() + N' | '; END CATCH;
-- ③ 入库单号回填 UPDATE(:1357)
BEGIN TRY
  BEGIN TRAN;
  UPDATE qc_insp_detail SET 入库单号 = N'__X__', asp_time2 = GETDATE() WHERE id = -1;
  ROLLBACK TRAN; SET @r += N'③入库号回填UPDATE ✓ ';
END TRY BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRAN; SET @r += N'③✗ ' + ERROR_MESSAGE() + N' | '; END CATCH;
-- ④ 生暂收退料 SELECT(:1378 含 不良数量 计算列)
BEGIN TRY
  SELECT id, 物料编码, 物料名称, 型号, 物料描述, 数量, 不良数量, 备注, 日期 FROM qc_insp_detail WHERE 1=0;
  SET @r += N'④退料生单SELECT ✓ ';
END TRY BEGIN CATCH SET @r += N'④✗ ' + ERROR_MESSAGE() + N' | '; END CATCH;
-- ⑤ 释放回填 UPDATE(:1442)
BEGIN TRY
  BEGIN TRAN;
  UPDATE qc_insp_detail SET 入库单号 = NULL, asp_time2 = GETDATE() WHERE id = -1;
  ROLLBACK TRAN; SET @r += N'⑤释放UPDATE ✓ ';
END TRY BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRAN; SET @r += N'⑤✗ ' + ERROR_MESSAGE() + N' | '; END CATCH;
SELECT @r AS result;
-- 计算列抽查:不良数量 == 不合格数量
SELECT TOP 3 不合格数量, 不良数量, CASE WHEN 不良数量 = 不合格数量 THEN N'同步✓' ELSE N'✗' END AS chk FROM qc_insp_detail;
