SET NOCOUNT ON;
PRINT '== ① 单据头状态 ==';
SELECT h.单据编号, h.单据日期, h.单据状态, h.是否已转ERP, h.asp_cancel AS 头作废, s.shr, s.canceled AS 状态机作废
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
 WHERE h.单据编号 = N'PI-2026-09-0143';
PRINT '== ② 明细行 ==';
SELECT l.id, l.存货编码, l.存货名称, l.仓库, l.仓库编码, l.实收数量, l.asp_cancel AS 行作废
  FROM bl_purchase_in l WHERE l.单据编号 = N'PI-2026-09-0143';
PRINT '== ③ 是否进了流水视图 ==';
SELECT src, rid, 单据日期, 仓库键, 仓库, 存货编码, 收入数量, 收入金额 FROM v_stock_movement WHERE 单据编号 = N'PI-2026-09-0143';
PRINT '== ④ 台账里有吗 ==';
SELECT 单据编号, 仓库, 存货, 收入数量, 收入金额 FROM v_stock_ledger WHERE 单据编号 = N'PI-2026-09-0143';
PRINT '== ⑤ 它的仓库在档案里吗(查询弹窗能否选到) ==';
SELECT w.仓库编码, w.仓库名称 FROM bs_wh w
 WHERE w.仓库名称 IN (SELECT 仓库 FROM bl_purchase_in WHERE 单据编号 = N'PI-2026-09-0143');
GO
