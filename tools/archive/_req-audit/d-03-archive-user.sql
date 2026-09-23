SET NOCOUNT ON;
-- d-03 采购订单归档状态方案(方案-采购订单归档状态.md)是否落地
SELECT COL_LENGTH('yj_doc_status','archived') AS archived列存在;
GO
SELECT panel_code, archived, COUNT(*) AS 行数
FROM yj_doc_status
WHERE panel_code IN (N'PU_ORDER',N'PURCHASE_IN',N'SO_ORDER',N'QC_INSP',N'QC_RECV')
GROUP BY panel_code, archived
ORDER BY panel_code, archived;
GO
SELECT COUNT(*) AS PU_ORDER已归档行数 FROM yj_doc_status WHERE panel_code=N'PU_ORDER' AND archived='Y';
GO
-- d-03b 归档状态推导是否在库里出现「已归档」文本(靠代码推导,库里不存)
SELECT TOP 20 panel_code, doc_no, shr, archived, archived_at FROM yj_doc_status WHERE archived='Y';
GO
-- d-03c 采购订单总量与状态分布(核对「200 张采购订单 138 张已完成」)
SELECT COUNT(DISTINCT 单据编号) AS 采购订单单据数 FROM bd_pu_order;
GO
SELECT erp_close_state AS 金蝶关闭状态, stopped AS MES中止, COUNT(*) AS 行数
FROM yj_doc_status WHERE panel_code=N'PU_ORDER' GROUP BY erp_close_state, stopped ORDER BY 行数 DESC;
GO
-- d-03d 用户/角色(C3 供应商账号类型 = 新用户类型/角色)
SELECT name AS 角色编码, * FROM yj_role;
GO
SELECT COUNT(*) AS 角色面板授权行数 FROM yj_role_panel;
GO
SELECT COL_LENGTH('yj_user','role_id') AS 有role_id, COL_LENGTH('yj_user','is_admin') AS 有is_admin;
GO
-- d-03e 面板配置里是否出现 batchFlow / 二维码 / 归档 等元数据旗标
SELECT panel_code, panel_name
FROM yj_panel
WHERE config LIKE N'%batchFlow%' OR config LIKE N'%archive%' OR config LIKE N'%qr%' OR config LIKE N'%Qr%'
   OR config LIKE N'%reportQueryDialog%';
GO
SELECT panel_code, SUBSTRING(config,1,300) AS config前300
FROM yj_panel WHERE panel_code=N'PU_ORDER';
GO
