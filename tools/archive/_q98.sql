SET NOCOUNT ON;
-- 1. MES基础资料量
SELECT N'供应商' AS t, COUNT(*) AS n FROM dm_gf WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>''
UNION ALL SELECT N'客户', COUNT(*) FROM dm_kh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>''
UNION ALL SELECT N'商品', COUNT(*) FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存货编码,'')<>''
UNION ALL SELECT N'仓库', COUNT(*) FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(仓库编码,'')<>''
UNION ALL SELECT N'职员', COUNT(*) FROM bs_emp WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(员工编码,'')<>''
UNION ALL SELECT N'部门', COUNT(*) FROM bs_dept WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(部门编码,'')<>'';
-- 2. 商品有没有规格型号
SELECT COUNT(*) AS 有规格型号 FROM bs_inv WHERE ISNULL(规格型号,'')<>'';
SELECT TOP 5 存货编码, LEFT(存货名称,12) AS 名称, 规格型号 FROM bs_inv WHERE ISNULL(规格型号,'')<>'' ORDER BY id;
-- 3. 供应商有没有地址电话等
SELECT TOP 3 dm, LEFT(mc,12) AS 名称, LEFT(ISNULL(tel,''),10) AS 电话, LEFT(ISNULL(addr,''),15) AS 地址 FROM dm_gf WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(dm,'')<>'' ORDER BY id;
