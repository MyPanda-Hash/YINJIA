SET NOCOUNT ON;
SELECT 目标面板, ISNULL(负责人,N'-') FROM rd_dev_task WHERE 产品编号 = N'T-PF-127309' ORDER BY 目标面板;