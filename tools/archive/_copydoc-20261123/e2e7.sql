SET NOCOUNT ON;
DELETE FROM rd_approval_detail WHERE 单据编号=N'CP382';
GO
INSERT INTO rd_approval_detail (单据编号, 备用1, 备用2, asp_user1, asp_time1) VALUES (N'LXA-2026-11-0031', N'明细行A', N'备注A', N'admin', GETDATE());
GO
INSERT INTO rd_approval_detail (单据编号, 备用1, 备用2, asp_user1, asp_time1) VALUES (N'LXA-2026-11-0031', N'明细行B', N'备注B', N'admin', GETDATE());
GO
INSERT INTO rd_approval_detail (单据编号, 备用1, 备用2, asp_user1, asp_time1, asp_cancel) VALUES (N'LXA-2026-11-0031', N'已作废行', N'不该被复制', N'admin', GETDATE(), 'Y');
GO
SELECT 单据编号+N' 存活行='+CONVERT(varchar(10),COUNT(*)) AS r FROM rd_approval_detail WHERE 单据编号=N'LXA-2026-11-0031' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号;
GO
DELETE FROM rd_approval WHERE 单据编号=N'LXA-2026-11-0033';
GO
