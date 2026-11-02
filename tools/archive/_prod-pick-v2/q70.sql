SET NOCOUNT ON;
-- 后端 latestAsmBom 到底取到哪张
SELECT 单据编号, 产品编号, 产品名称, 单据日期, ISNULL(asp_cancel,'N') 作废 FROM rd_asm_bom_head ORDER BY 产品编号, 单据日期 DESC, id DESC;
GO
SELECT 单据编号, 序号, 物料编号, 物料名, 用量 FROM rd_asm_bom_detail ORDER BY 单据编号, 序号;
