SET NOCOUNT ON;
PRINT N'=== 复原前:该目录行 + 刚写的修改记录 ===';
SELECT id, 单据编号, 检验数据记录单号, 检验状态, 是否合格 FROM qc_catalog_detail WHERE id = 11;
SELECT TOP 3 id, panel_code, doc_no, apply_by, apply_at, rearchive_by FROM yj_doc_modify_log WHERE panel_code = N'QC_CATALOG' ORDER BY id DESC;
GO
PRINT N'=== 复原:回到已完成检验 + 删掉本轮验证写入的修改记录 ===';
UPDATE qc_catalog_detail SET 检验状态 = N'已完成检验' WHERE id = 11 AND 检验数据记录单号 = N'JYSJ-2026-09-0032';
PRINT N'[复原] 目录行更新行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM yj_doc_modify_log
 WHERE panel_code = N'QC_CATALOG' AND doc_no = N'JYML-2026-09-0001'
   AND apply_at > DATEADD(minute, -30, GETDATE());
PRINT N'[复原] 删除本轮修改记录行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
SELECT id, 检验数据记录单号, 检验状态, 是否合格 FROM qc_catalog_detail WHERE id = 11;
SELECT COUNT(*) AS 剩余目录修改记录 FROM yj_doc_modify_log WHERE panel_code = N'QC_CATALOG';
