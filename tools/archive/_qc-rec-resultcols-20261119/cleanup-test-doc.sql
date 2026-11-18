SET NOCOUNT ON;
-- 清掉本轮 UI 验证在测试账套里留的痕迹(只动这张单:空行 + 第6格 + 列数归 5)
DELETE FROM dbo.qc_insp_rec_detail WHERE 单据编号 = N'JYSJ-2026-11-0021' AND id = 51 AND ISNULL(检验项,N'') = N'';
UPDATE dbo.qc_insp_rec_detail SET 结果6 = NULL, 结果7 = NULL
 WHERE 单据编号 = N'JYSJ-2026-11-0021' AND (ISNULL(结果6,N'') <> N'' OR ISNULL(结果7,N'') <> N'');
UPDATE dbo.qc_insp_rec SET 结果列数 = 5 WHERE 单据编号 = N'JYSJ-2026-11-0021' AND 结果列数 = 6;
SELECT 单据编号, 结果列数 FROM dbo.qc_insp_rec WHERE 单据编号 = N'JYSJ-2026-11-0021';
SELECT COUNT(*) AS 明细行数 FROM dbo.qc_insp_rec_detail WHERE 单据编号 = N'JYSJ-2026-11-0021';
