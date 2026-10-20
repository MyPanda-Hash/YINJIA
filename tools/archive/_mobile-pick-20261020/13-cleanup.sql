/* 清理本轮探针在测试账套造的数据(只删本轮生成的单与工单种子) */
SET NOCOUNT ON;
DECLARE @nos TABLE (no nvarchar(50));
INSERT INTO @nos VALUES (N'LL-2026-10-0001'), (N'LL-2026-10-0002');

DELETE FROM dbo.bl_material_out WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM dbo.bd_material_out WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM dbo.yj_doc_status WHERE panel_code = N'MATERIAL_OUT' AND doc_no IN (SELECT no FROM @nos);
DELETE FROM dbo.plang WHERE pl_no = N'GD-TEST-MP01';

SELECT COUNT(*) AS 残留单头 FROM dbo.bd_material_out WHERE 单据编号 IN (SELECT no FROM @nos);
SELECT COUNT(*) AS 残留工单 FROM dbo.plang WHERE pl_no = N'GD-TEST-MP01';
