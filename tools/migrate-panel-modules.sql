/* 面板模块分组(对齐 HSDZ 真实模块体系 permission.GROP):
   JCZL 基础资料 / DDGL 订单管理 / CKGL 仓库管理 / SCGL 生产管理 */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF COL_LENGTH('yj_panel', 'module_group') IS NULL
    ALTER TABLE yj_panel ADD module_group nvarchar(40) NULL;
GO
UPDATE yj_panel SET module_group = N'基础资料' WHERE panel_code IN ('KHDA','GFDA','YWYDA','CKDA','ZDGL');
UPDATE yj_panel SET module_group = N'订单管理' WHERE panel_code IN ('KHDD','CGD');
UPDATE yj_panel SET module_group = N'仓库管理' WHERE panel_code IN ('RKD','CKD','STOCK_STATUS');
UPDATE yj_panel SET module_group = N'生产管理' WHERE panel_code IN ('WLBOM');
UPDATE yj_panel SET module_group = N'系统管理' WHERE module_group IS NULL;
GO
DECLARE @c int = (SELECT COUNT(*) FROM yj_panel WHERE module_group IS NOT NULL);
PRINT N'面板模块分组完成: ' + CAST(@c AS nvarchar(10)) + N' 个面板';
GO
