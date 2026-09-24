SET NOCOUNT ON;
PRINT '== Y-GL-300400 的采购订单行 ==';
SELECT TOP 6 h.单据编号, h.单据日期, l.物料编码, l.规格型号, l.数量
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号 = l.单据编号
 WHERE l.物料编码 = N'Y-GL-300400' ORDER BY l.id DESC;
PRINT '== 档案里的规格(存货档案) ==';
SELECT TOP 3 存货编码, 存货名称, 规格型号 FROM bs_inv WHERE 存货编码 = N'Y-GL-300400';
PRINT '== 最近订单行(按时间倒序,看规格整体情况) ==';
SELECT TOP 10 h.单据编号, h.单据日期, l.物料编码, l.规格型号
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号 = l.单据编号
 ORDER BY h.id DESC, l.id DESC;
GO
