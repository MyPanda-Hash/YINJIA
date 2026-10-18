SET NOCOUNT ON;
SELECT panel_code, panel_name, ISNULL(module_group,N'(NULL)') AS module_group FROM yj_panel WHERE module_group IN
   (N'库存核算', N'库存报表', N'基础设置', N'基础资料', N'基础数据', N'采购管理', N'订单管理',
    N'生产管理', N'委外加工', N'销售管理', N'物料及价格', N'财务管理', N'设备管理', N'条码管理');
PRINT '--- 采购订单面板当前分组 ---';
SELECT panel_code, panel_name, ISNULL(module_group,N'(NULL)') AS module_group FROM yj_panel WHERE panel_code LIKE 'PU_ORDER%';
