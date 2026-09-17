SET NOCOUNT ON;
UPDATE qc_insp_detail SET 型号 = 规格型号 WHERE 型号 IS NULL AND 规格型号 IS NOT NULL;
UPDATE qc_insp_detail SET 数量 = 送检数量 WHERE 数量 IS NULL AND 送检数量 IS NOT NULL;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_insp_detail') ORDER BY c.column_id;
