SET NOCOUNT ON;
INSERT INTO rd_prod_info_head (单据编号, 单据日期, 产品编号, 产品名称, 产品类别, 客户项目名称, 产品负责人,
                               产品形态, 产品功能类别, 产品管控等级, 审核人一级, 审核人二级, 备注, asp_user1, asp_time1)
VALUES (N'DEMO-PI-001', N'2026-09-21', N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'滤芯', N'演示客户项目-A', N'陈秀丽',
        N'成品', N'除重金属', N'二级', N'系统管理员', N'彭于晏', N'演示数据', N'cp', GETDATE());
GO
