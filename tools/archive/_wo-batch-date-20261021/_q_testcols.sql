SET NOCOUNT ON;
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.plang')
 AND c.name IN (N'批次号',N'完工状态',N'asp_time1',N'ja',N'pl_sl',N'rk_sl',N'pl_date',N'asp_cancel')
 ORDER BY c.name;
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_finish_in') AND c.name IN (N'批次号',N'工单行号',N'加工单号');
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.scjl') AND c.name IN (N'批次号',N'lot_no',N'工单行号',N'gd_id');
GO
