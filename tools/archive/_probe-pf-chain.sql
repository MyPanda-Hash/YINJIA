SET NOCOUNT ON;
SELECT 单据编号, ISNULL(变更来源单号,N'(旧版/原始)') FROM rd_mold_proc_head WHERE 产品编号 = N'T-PF-127309' ORDER BY id;