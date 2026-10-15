SET NOCOUNT ON;
PRINT N'=== DB ==='; SELECT DB_NAME() AS 数据库;
PRINT N'=== object counts ===';
SELECT 'bd_so_order' AS 对象,COUNT(*) AS 行数 FROM dbo.bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'bl_so_order',COUNT(*) FROM dbo.bl_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'form_flow_link_ACTIVE',COUNT(*) FROM dbo.form_flow_link WHERE link_status='ACTIVE'
UNION ALL SELECT 'plang',COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'plang_pc',COUNT(*) FROM dbo.plang_pc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'scjl',COUNT(*) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'scjl_done',COUNT(*) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y' AND RTRIM(ISNULL(wgzt,N''))=N'Y';
PRINT N'=== flow targets ===';
SELECT target_panel_code AS 目标面板,COUNT(*) AS 链接行数,SUM(ISNULL(linked_quantity,0)) AS 占用数量
FROM dbo.form_flow_link WHERE source_panel_code='SO_ORDER' AND link_status='ACTIVE' GROUP BY target_panel_code ORDER BY target_panel_code;
PRINT N'=== order links without exact source line ===';
SELECT COUNT(*) AS 异常数 FROM dbo.form_flow_link f
LEFT JOIN dbo.bl_so_order l ON f.source_panel_code='SO_ORDER' AND f.source_line_key=l.[单据编号]+N'#'+CONVERT(nvarchar(20),l.id)
WHERE f.source_panel_code='SO_ORDER' AND f.link_status='ACTIVE' AND l.id IS NULL;
PRINT N'=== plang schedule consistency ===';
SELECT COUNT(*) AS 已排主行,
 SUM(CASE WHEN ISNULL(pc.id,0)=0 THEN 1 ELSE 0 END) AS 缺排产镜像,
 SUM(CASE WHEN ISNULL(pc.pl_sl,0)<>ISNULL(p.pl_sl,0) THEN 1 ELSE 0 END) AS 数量不一致,
 SUM(CASE WHEN ISNULL(pc.pl_sl,0)<=0 AND ISNULL(p.pl_sl,0)>0 THEN 1 ELSE 0 END) AS 排产表零数量
FROM dbo.plang p LEFT JOIN dbo.plang_pc pc ON pc.plang_id=p.id AND ISNULL(pc.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N'';
SELECT TOP 50 p.id,p.pl_no,p.pl_xc,p.[批次号],p.xq_sl,p.pl_sl,p.scx,pc.id AS pc_id,pc.pl_sl AS pc_pl_sl,pc.scx AS pc_scx
FROM dbo.plang p LEFT JOIN dbo.plang_pc pc ON pc.plang_id=p.id AND ISNULL(pc.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''
 AND (ISNULL(pc.id,0)=0 OR ISNULL(pc.pl_sl,0)<>ISNULL(p.pl_sl,0) OR ISNULL(pc.scx,N'')<>ISNULL(p.scx,N'') ) ORDER BY p.id;
PRINT N'=== schedule lines ===';
SELECT pc.scx AS 生产线,COUNT(*) AS 排产行数,SUM(ISNULL(pc.pl_sl,0)) AS 排产数量,
 SUM(CASE WHEN pl.生产线 IS NULL THEN 1 ELSE 0 END) AS 产线档案缺失,
 SUM(CASE WHEN ISNULL(pl.停用,0)=1 THEN 1 ELSE 0 END) AS 排入停用线
FROM dbo.plang_pc pc LEFT JOIN dbo.bs_prod_line pl ON pl.生产线=pc.scx AND ISNULL(pl.asp_cancel,'N')<>'Y'
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N'' GROUP BY pc.scx ORDER BY pc.scx;
PRINT N'=== report identity ===';
SELECT COUNT(*) AS 报工有效,
 SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) AS 工单行不存在,
 SUM(CASE WHEN ISNULL(s.gd_id,0)>0 AND pc.id IS NULL THEN 1 ELSE 0 END) AS 报工锚点不存在,
 SUM(CASE WHEN ISNULL(s.gd_id,0)>0 AND pc.plang_id<>p.id THEN 1 ELSE 0 END) AS 锚点行不一致,
 SUM(CASE WHEN s.[工单行号] IS NOT NULL AND p.id IS NOT NULL AND ISNULL(s.[工单行号],0)<>ISNULL(p.pl_xc,0) THEN 1 ELSE 0 END) AS 报工行号不一致
FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id=s.gd_id LEFT JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y';
SELECT TOP 50 s.id,s.[报工单号],s.gldh,s.[工单行号],s.[批次号],s.gxdm,s.sl,s.wgzt,s.gd_id,pc.plang_id,p.pl_xc,p.pl_sl,pc.scx
FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id=s.gd_id LEFT JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND (p.id IS NULL OR (s.[工单行号] IS NOT NULL AND ISNULL(s.[工单行号],0)<>ISNULL(p.pl_xc,0))) ORDER BY s.id;
PRINT N'=== report vs scheduled row ===';
SELECT TOP 50 s.gldh AS 工单号,p.pl_xc AS 工单行号,s.gxdm AS 工序,pc.scx AS 生产线,
 SUM(CASE WHEN RTRIM(ISNULL(s.wgzt,N''))=N'Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 已审核报工量,
 MAX(ISNULL(p.pl_sl,0)) AS 排产量
FROM dbo.scjl s JOIN dbo.plang_pc pc ON pc.id=s.gd_id JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(s.asp_cancel,'N')<>'Y' GROUP BY s.gldh,p.pl_xc,s.gxdm,pc.scx
HAVING SUM(CASE WHEN RTRIM(ISNULL(s.wgzt,N''))=N'Y' THEN ISNULL(s.sl,0) ELSE 0 END)>MAX(ISNULL(p.pl_sl,0))*10
ORDER BY s.gldh,p.pl_xc,s.gxdm;
PRINT N'=== done without receipt ===';
SELECT COUNT(*) AS 已完工报工无入库回写 FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND RTRIM(ISNULL(s.wgzt,N''))=N'Y' AND ISNULL(s.post_no,N'')=N'';
PRINT N'=== plang vs plang_pc row totals ===';
SELECT 'plang' AS 来源,COUNT(*) AS 行数,SUM(ISNULL(pl_sl,0)) AS 排产数量,SUM(ISNULL(xq_sl,0)) AS 需求数量 FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'plang_pc',COUNT(*),SUM(ISNULL(pl_sl,0)),SUM(ISNULL(xq_sl,0)) FROM dbo.plang_pc WHERE ISNULL(asp_cancel,'N')<>'Y';
