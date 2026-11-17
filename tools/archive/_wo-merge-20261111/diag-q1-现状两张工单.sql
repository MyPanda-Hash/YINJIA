SELECT TOP 40 pl_no, pl_xc, ISNULL(od_no,N'') AS od_no, od_xc, CONVERT(varchar(10), pl_date,120) AS pl_date,
       dm, mc, gg, pl_sl, xq_sl, yl, khdm, ISNULL([工艺路线],N'') AS route,
       CONVERT(varchar(19), asp_time1, 120) AS asp_time1
FROM dbo.plang
WHERE pl_no IN (N'GD-2026-11-0011', N'GD-2026-11-0010', N'GD-2026-11-0009')
ORDER BY pl_no, pl_xc;
GO
SELECT o.单据编号, CONVERT(varchar(10), o.单据日期,120) AS 单据日期, o.客户, l.id, l.行号, l.存货编码, l.存货名称, l.数量
FROM dbo.bd_so_order o JOIN dbo.bl_so_order l ON l.单据编号=o.单据编号
WHERE l.存货编码 IN (N'A-48-01', N'A-48-09')
  AND CONVERT(varchar(10), o.单据日期,120) >= '2026-11-01'
ORDER BY o.单据编号, l.行号;
GO
SELECT TOP 20 source_form_no, source_line_key, target_panel_code, target_form_no, target_line_key, linked_quantity,
       CONVERT(varchar(19), create_time,120) AS create_time
FROM dbo.form_flow_link
WHERE target_form_no IN (N'GD-2026-11-0011', N'GD-2026-11-0010')
ORDER BY create_time DESC;
GO
