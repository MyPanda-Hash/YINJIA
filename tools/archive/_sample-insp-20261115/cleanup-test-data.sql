/* cleanup-test-data.sql(2026-11-15):清掉 UI/API 联调在**测试账套**产生的检验委托单与目录临时行。
 * 只允许在 HSDZ_MES_TEST 执行(库名硬闸门);正式账套 HSDZ_MES 执行会 RAISERROR 中止。
 * s_allno 号池保留不复用(与既往清理口径一致)。 */
IF DB_NAME() = N'HSDZ_MES'
  RAISERROR(N'本脚本只允许在测试账套 HSDZ_MES_TEST 执行(正式库可能含真实业务单据),已中止。', 16, 1);
GO
IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'当前库不是 HSDZ_MES_TEST,已中止。', 16, 1);
  RETURN;
END
GO

DECLARE @nos TABLE (no nvarchar(50));
INSERT INTO @nos (no)
SELECT 单据编号 FROM dbo.qc_insp_commission_head WHERE 单据编号 LIKE N'WT-%' OR 备注 LIKE N'%联调%' OR 备注 LIKE N'%走查%' OR 委托单位 LIKE N'%联调%' OR 委托单位 LIKE N'%走查%';
DELETE FROM dbo.qc_insp_commission_detail WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM dbo.qc_insp_commission_head WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM dbo.yj_form_approval WHERE panel_code = N'INSP_COMMISSION' AND form_no IN (SELECT no FROM @nos);
DELETE FROM dbo.yj_doc_status WHERE panel_code = N'INSP_COMMISSION' AND doc_no IN (SELECT no FROM @nos);
-- 目录临时行(物理删除;正常业务删除走软删 asp_cancel='Y')
DELETE FROM dbo.qc_sample_reg WHERE 检测元素 LIKE N'%联调新增项%';
SELECT N'剩余检验委托单' AS k, COUNT(*) AS n FROM dbo.qc_insp_commission_head
UNION ALL SELECT N'剩余委托单行', COUNT(*) FROM dbo.qc_insp_commission_detail
UNION ALL SELECT N'剩余审批留痕', COUNT(*) FROM dbo.yj_form_approval WHERE panel_code = N'INSP_COMMISSION'
UNION ALL SELECT N'剩余单据状态', COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'INSP_COMMISSION'
UNION ALL SELECT N'送样登记表存活行', COUNT(*) FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y';
GO
