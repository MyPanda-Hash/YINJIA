SET NOCOUNT ON;
DECLARE @today nvarchar(40) = CONVERT(nvarchar(10), GETDATE(), 120);
PRINT N'A: 产品信息表插入';
INSERT INTO rd_prod_info_head (单据编号, 单据日期, 产品编号, 产品名称, 产品类别, 客户项目名称, 产品负责人,
                               产品形态, 产品功能类别, 产品管控等级, 审核人一级, 审核人二级, 备注, asp_user1, asp_time1)
VALUES (N'DEMO-PI-001', @today, N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'滤芯', N'演示客户项目-A', N'陈秀丽',
        N'成品', N'除重金属', N'二级', N'系统管理员', N'彭于晏', N'演示数据', N'cp', GETDATE());
PRINT N'A 完成';
GO
PRINT N'D: rd_dev_task 插入';
INSERT INTO rd_dev_task (产品编号, 产品名称, 源单据号, 目标面板, 下发人, 下发时间, 负责人, asp_user1, asp_time1)
SELECT v.产品编号, v.产品名称, v.源单据号, v.目标面板, N'glm53', GETDATE(), v.负责人, N'glm53', GETDATE()
FROM (VALUES (N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'DEMO-PI-001', N'RD_MOLD_PROC', N'cp')) AS v(产品编号, 产品名称, 源单据号, 目标面板, 负责人);
PRINT N'D 完成';
GO
