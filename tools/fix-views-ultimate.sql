-- 最终修复 v2:DETAIL 视图"单据状态/审核人"由 yj_doc_status 工作流注册表派生,
-- 与单据面板(销售订单/采购入库…)显示保持一致,不再读业务表物理列
-- (种子数据直写的状态值与 UI 审核留痕从此不再打架)
USE HSDZ_MES;
SET NOCOUNT ON;
DECLARE @dn sysname, @dd nvarchar(max);
DECLARE dc CURSOR FOR SELECT name FROM sys.views WHERE name LIKE 'v[_]%';
OPEN dc; FETCH NEXT FROM dc INTO @dn;
WHILE @@FETCH_STATUS = 0 BEGIN SET @dd = N'DROP VIEW [' + @dn + N']'; EXEC(@dd); FETCH NEXT FROM dc INTO @dn; END
CLOSE dc; DEALLOCATE dc;

DECLARE @pairs TABLE (code varchar(50), head sysname, line sysname, noCol sysname, panel varchar(50));
INSERT INTO @pairs VALUES
('purchase_in','bd_purchase_in','bl_purchase_in',N'单据编号','PURCHASE_IN'),
('finish_in','bd_finish_in','bl_finish_in',N'单据编号','FINISH_IN'),
('other_in','bd_other_in','bl_other_in',N'单据编号','OTHER_IN'),
('sale_out','bd_sale_out','bl_sale_out',N'单据编号','SALE_OUT'),
('material_out','bd_material_out','bl_material_out',N'单据编号','MATERIAL_OUT'),
('other_out','bd_other_out','bl_other_out',N'单据编号','OTHER_OUT'),
('manu_order','bd_manu_order','bl_manu_order',N'合同号','MANU_ORDER'),
('dispatch','bd_dispatch','bl_dispatch',N'单据编号','DISPATCH'),
('outsource_issue','bd_outsource_issue','bl_outsource_issue',N'单据编号','OUTSOURCE_ISSUE'),
('outsource_in','bd_outsource_in','bl_outsource_in',N'单据编号','OUTSOURCE_IN');
DECLARE @code varchar(50), @h sysname, @l sysname, @nc sysname, @panel varchar(50), @lc nvarchar(max), @hc nvarchar(max), @sql nvarchar(max);
DECLARE p CURSOR FOR SELECT code, head, line, noCol, panel FROM @pairs;
OPEN p; FETCH NEXT FROM p INTO @code, @h, @l, @nc, @panel;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @lc = '';
  SELECT @lc = @lc + N', l.[' + c.name + N']' FROM sys.columns c
  WHERE c.object_id = OBJECT_ID(@l)
    AND c.name NOT IN (N'id',N'asp_user1',N'asp_time1',N'asp_cancel',N'asp_user2',N'asp_time2', @nc)
    AND c.name NOT IN (SELECT c2.name FROM sys.columns c2 WHERE c2.object_id = OBJECT_ID(@h))
  ORDER BY c.column_id;
  SET @hc = '';
  SELECT @hc = @hc + N', h.[' + c.name + N']' FROM sys.columns c
  WHERE c.object_id = OBJECT_ID(@h)
    AND c.name NOT IN (N'单据状态', N'审核人')   -- 由注册表派生
  ORDER BY c.column_id;
  SET @sql = N'CREATE VIEW v_' + @code + '_detail AS SELECT ' + STUFF(@hc, 1, 2, N'') + @lc
    + N', CASE WHEN ISNULL(s.canceled,N''N'')=N''Y'' THEN N''已作废'''
    + N' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'''
    + N' WHEN s.shr IS NOT NULL THEN N''已审核'''
    + N' ELSE N''草稿'' END AS [单据状态]'
    + N', s.shr AS [审核人]'
    + N' FROM ' + @h + N' h LEFT JOIN ' + @l + N' l ON h.[' + @nc + N']=l.[' + @nc + N']'
    + N' LEFT JOIN yj_doc_status s ON s.panel_code = ''' + @panel + N''' AND s.doc_no = h.[' + @nc + N']';
  EXEC(@sql);
  FETCH NEXT FROM p INTO @code, @h, @l, @nc, @panel;
END
CLOSE p; DEALLOCATE p;
PRINT 'DETAIL 10 OK';
EXEC('CREATE VIEW v_purchase_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_finish_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[产品名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[产品名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_other_in_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_sale_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[销售金额],0)) AS [金额] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_material_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_other_out_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_manu_order_stats AS SELECT h.asp_cancel, l.[产品名称], COUNT(DISTINCT h.[合同号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [计划数量], SUM(COALESCE(l.[累计汇报套数(工序单位)],0)) AS [完工数量] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号] GROUP BY h.asp_cancel, l.[产品名称]');
EXEC('CREATE VIEW v_dispatch_stats AS SELECT h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序名称], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [派工单数], SUM(COALESCE(l.[计划数量],0)) AS [计划数量], SUM(COALESCE(l.[派工数量],0)) AS [派工数量], SUM(COALESCE(l.[累计汇报数量],0)) AS [累计汇报数量], MAX(l.[派工加工状态]) AS [派工加工状态] FROM bd_dispatch h LEFT JOIN bl_dispatch l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, l.[生产车间], l.[工序名称], l.[计量单位]');
EXEC('CREATE VIEW v_outsource_issue_stats AS SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[材料名称], l.[规格型号], l.[计量单位]');
EXEC('CREATE VIEW v_outsource_in_stats AS SELECT h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号] GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], l.[产品名称], l.[规格型号], l.[计量单位]');
PRINT 'STATS 10 OK';
SELECT COUNT(*) AS views FROM sys.views WHERE name LIKE 'v[_]%';
