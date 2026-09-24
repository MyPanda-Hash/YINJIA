SET NOCOUNT ON;
PRINT '== 快照 vs 当前:QC_RECV 字段差异 ==';
SELECT ISNULL(r.seq, t.seq) AS seq, ISNULL(r.col_name, t.col_name) AS col, r.hidden AS 快照h, t.hidden AS 当前h, r.seq AS 快照seq, t.seq AS 当前seq
  FROM HSDZ_MES_RESTORE.dbo.yj_field r FULL JOIN yj_field t
    ON t.panel_code = r.panel_code AND t.col_name = r.col_name AND t.place = r.place
 WHERE (r.panel_code = 'QC_RECV' OR t.panel_code = 'QC_RECV')
   AND (r.id IS NULL OR t.id IS NULL OR ISNULL(r.hidden,0) <> ISNULL(t.hidden,0) OR ISNULL(r.seq,0) <> ISNULL(t.seq,0))
 ORDER BY ISNULL(r.seq, t.seq);
GO
PRINT '== 快照 vs 当前:批次号字段(链路面板) ==';
SELECT ISNULL(r.panel_code, t.panel_code) AS panel, r.hidden AS 快照h, t.hidden AS 当前h, r.seq AS 快照seq, t.seq AS 当前seq, r.place AS 快照place, t.place AS 当前place
  FROM HSDZ_MES_RESTORE.dbo.yj_field r FULL JOIN yj_field t
    ON t.panel_code = r.panel_code AND t.col_name = r.col_name
 WHERE (r.panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','PURCHASE_IN','QC_RETURN') OR t.panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','PURCHASE_IN','QC_RETURN'))
   AND (r.col_name = N'批次号' OR t.col_name = N'批次号');
GO
PRINT '== 快照 vs 当前:转ERP四列登记(PURCHASE_IN/SALE_OUT/PU_ORDER) ==';
SELECT ISNULL(r.panel_code, t.panel_code) AS panel, ISNULL(r.col_name, t.col_name) AS col,
       r.hidden AS 快照h, t.hidden AS 当前h
  FROM HSDZ_MES_RESTORE.dbo.yj_field r FULL JOIN yj_field t
    ON t.panel_code = r.panel_code AND t.col_name = r.col_name AND t.place = r.place
 WHERE (r.col_name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间') OR t.col_name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间'))
   AND (r.panel_code IN ('PURCHASE_IN','SALE_OUT','PU_ORDER') OR t.panel_code IN ('PURCHASE_IN','SALE_OUT','PU_ORDER'))
 ORDER BY panel, col;
GO
