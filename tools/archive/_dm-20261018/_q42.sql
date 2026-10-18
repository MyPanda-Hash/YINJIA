SET NOCOUNT ON;
SELECT panel_code, panel_name, ISNULL(module_group,'(NULL)') AS module_group, ISNULL(category,'(NULL)') AS category FROM yj_panel WHERE module_group NOT IN (N'我的桌面',N'研发管理',N'智能供应链',N'库存核算',N'库存报表',N'采购管理',N'订单管理',N'销售管理',N'生产制造',N'生产管理',N'委外加工',N'品质管理',N'数据建模',N'基础档案',N'基础资料',N'基础数据',N'基础设置',N'物料及价格',N'设备管理',N'财务管理',N'其他') OR module_group IS NULL;
