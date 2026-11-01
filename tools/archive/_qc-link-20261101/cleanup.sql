/* cleanup.sql —— 清掉 _qc-link-20261101 取证造数(只在测试账套执行)
 * 硬闸门:库名不等于 HSDZ_MES_TEST 即 RAISERROR 16 停手。
 */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR(N'[FATAL] cleanup.sql 只允许在测试账套 HSDZ_MES_TEST 执行,当前库=%s', 16, 1, @db);
    RETURN;
END

DELETE FROM dbo.yj_doc_status WHERE doc_no IN (N'ZC-TEST-0001', N'BHG-TEST-0001', N'BHC-TEST-0001');
DELETE FROM dbo.qc_proc_insp_head WHERE 单据编号 = N'ZC-TEST-0001';
DELETE FROM dbo.qc_bhg            WHERE 单据编号 = N'BHG-TEST-0001';
DELETE FROM dbo.qc_bhc            WHERE 单据编号 = N'BHC-TEST-0001';
GO
IF EXISTS (SELECT 1 FROM dbo.yj_doc_status WHERE doc_no IN (N'ZC-TEST-0001', N'BHG-TEST-0001', N'BHC-TEST-0001'))
   OR EXISTS (SELECT 1 FROM dbo.qc_proc_insp_head WHERE 单据编号 = N'ZC-TEST-0001')
   OR EXISTS (SELECT 1 FROM dbo.qc_bhg WHERE 单据编号 = N'BHG-TEST-0001')
   OR EXISTS (SELECT 1 FROM dbo.qc_bhc WHERE 单据编号 = N'BHC-TEST-0001')
    RAISERROR(N'[FAIL] 造数未清干净', 16, 1);
ELSE
    RAISERROR(N'[PASS] 测试账套造数已清理', 10, 1);
GO
