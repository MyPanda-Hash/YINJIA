SET NOCOUNT ON;
SELECT 'wo_proc_card_head' t, COUNT(*) n FROM sys.columns WHERE object_id=OBJECT_ID('dbo.wo_proc_card_head')
UNION ALL SELECT 'wo_proc_card_detail', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.wo_proc_card_detail');
