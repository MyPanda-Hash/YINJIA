SET NOCOUNT ON;
SELECT 'BEFORE|'+ISNULL(客户名,N'∅')+N'|'+ISNULL(客户编号,N'∅')+N'|'+ISNULL(文档编号,N'∅')+N'|'+ISNULL(申请立项人,N'∅')+N'|'+ISNULL(申请立项日期,N'∅')+N'|'+ISNULL(项目等级,N'∅')+N'|'+ISNULL(备用1,N'∅')+N'|'+ISNULL(附件1,N'∅') AS r
FROM rd_approval WHERE 单据编号=N'LXA-2026-11-0031';
GO
UPDATE rd_approval SET 客户名=N'测试客户甲', 客户编号=N'KH00001', 文档编号=N'KH0000120261120',
  申请立项人=N'张莉', 项目等级=N'二级', 备用1=N'chenxiuli', 附件1=N'attach-anchor-001',
  立项背景=N'复制功能测试源单'
WHERE 单据编号=N'LXA-2026-11-0031';
GO
SELECT 'SEEDED|'+ISNULL(客户名,N'∅')+N'|'+ISNULL(客户编号,N'∅')+N'|'+ISNULL(文档编号,N'∅')+N'|'+ISNULL(申请立项人,N'∅')+N'|'+ISNULL(项目等级,N'∅')+N'|'+ISNULL(备用1,N'∅')+N'|'+ISNULL(附件1,N'∅')+N'|'+ISNULL(立项背景,N'∅') AS r
FROM rd_approval WHERE 单据编号=N'LXA-2026-11-0031';
GO
INSERT INTO rd_approval_detail (单据编号, asp_user1, asp_time1) VALUES (N'CP382', N'admin', GETDATE());
GO
INSERT INTO rd_approval_detail (单据编号, asp_user1, asp_time1) VALUES (N'CP382', N'admin', GETDATE());
GO
