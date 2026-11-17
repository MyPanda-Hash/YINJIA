/* 一次性清理:2026-11-17 检验委托单修订联调在**测试账套**建的两张单(WT-2026-11-9001/9002)。
 * 只在 HSDZ_MES_TEST 执行;正式账套未写入任何数据。号池 s_allno 保留不复用(按惯例)。 */

SET NOCOUNT ON;
GO

IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'本脚本只允许在测试账套执行(当前库不是 HSDZ_MES_TEST)', 16, 1);
    RETURN;
END
GO

DELETE FROM dbo.qc_insp_commission_detail WHERE 单据编号 IN (N'WT-2026-11-9001', N'WT-2026-11-9002');
PRINT N'[删] 明细行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.qc_insp_commission_head WHERE 单据编号 IN (N'WT-2026-11-9001', N'WT-2026-11-9002');
PRINT N'[删] 头行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_doc_status WHERE panel_code = N'INSP_COMMISSION' AND doc_no IN (N'WT-2026-11-9001', N'WT-2026-11-9002');
PRINT N'[删] 状态行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
IF OBJECT_ID(N'dbo.yj_form_approval', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.yj_form_approval WHERE panel_code = N'INSP_COMMISSION' AND form_no IN (N'WT-2026-11-9001', N'WT-2026-11-9002');
    PRINT N'[删] 审批留痕行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
END
GO

SELECT
    (SELECT COUNT(*) FROM dbo.qc_insp_commission_head)   AS 头表,
    (SELECT COUNT(*) FROM dbo.qc_insp_commission_detail) AS 行表,
    (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'INSP_COMMISSION') AS 状态行;
GO
