SET NOCOUNT ON;
SELECT COUNT(*) hd_cols FROM sys.columns WHERE object_id=OBJECT_ID('dbo.wo_proc_card_head');
SELECT COUNT(*) hd_desc FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID('dbo.wo_proc_card_head') AND minor_id>0 AND name='MS_Description';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.wo_proc_card_head') AND name=N'批次来源';
