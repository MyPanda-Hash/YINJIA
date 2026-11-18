SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('scjl') AND name IN ('asp_cancel','comm','delmark');
SELECT COUNT(*) AS with_cancel_col FROM sys.columns WHERE object_id=OBJECT_ID('scjl') AND name='asp_cancel';
GO
