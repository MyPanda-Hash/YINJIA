SET NOCOUNT ON;
INSERT INTO rd_sample_nondev_head (单据编号, 单据日期, 客户名称, 费用, 期望交期, 申请, 审核, 确认, 备注, 进度描述, asp_user1, asp_time1)
VALUES (N'SPN2-E2E-SRC-01', N'2026-11-01', N'复制测试客户', N'1200', N'2026-12-01', N'张三/2026.11.1', N'李四/2026.11.2', N'王五/2026.11.3', N'源单备注', N'已寄样', N'admin', GETDATE());
GO
INSERT INTO rd_sample_nondev_detail (单据编号, 产品编码, 产品名称, 产品整体规格, 样品数量, asp_user1, asp_time1) VALUES (N'SPN2-E2E-SRC-01', N'T382', N'除重金属炭棒滤芯', N'规格A', N'5', N'admin', GETDATE());
GO
INSERT INTO rd_sample_nondev_detail (单据编号, 产品编码, 产品名称, 产品整体规格, 样品数量, asp_user1, asp_time1) VALUES (N'SPN2-E2E-SRC-01', N'T382S', N'除重金属炭棒滤芯S', N'规格B', N'8', N'admin', GETDATE());
GO
SELECT 'SEEDED nondev src ok' AS r;
GO
