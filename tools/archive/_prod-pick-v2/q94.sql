SET NOCOUNT ON;
SELECT 状态, COUNT(*) n FROM wo_pick_doc GROUP BY 状态;
