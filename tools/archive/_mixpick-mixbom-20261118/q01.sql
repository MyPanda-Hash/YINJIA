SET NOCOUNT ON;
PRINT '== bs_mix_bom 概况 ==';
SELECT COUNT(*) AS rows, COUNT(DISTINCT 单据编号) AS docs, COUNT(DISTINCT 产品编号) AS prods FROM dbo.bs_mix_bom;
PRINT '== bs_mix_bom 样例行 ==';
SELECT TOP 25 单据编号, 产品编号, 产品名称, 烧结类型, 行序, 物料种类, 物料编号, 物料名称, 添加比例, 单支含量g, 设计添加量 FROM dbo.bs_mix_bom ORDER BY 单据编号, 行序;
PRINT '== 工单行样本(未完工/未开单) ==';
SELECT TOP 10 p.pl_no, p.pl_xc, p.dm, p.mc, p.pl_sl, p.scx FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.pl_sl,0)>0 ORDER BY p.id DESC;
PRINT '== 组装清单里的半品行(**TB)样本 ==';
SELECT TOP 20 b.单据编号, b.产品编码, b.子件编码, b.子件名称, b.标准用量, b.计量单位 FROM dbo.bs_asm_bom b WHERE b.子件编码 LIKE '%**TB%' ORDER BY b.id DESC;
