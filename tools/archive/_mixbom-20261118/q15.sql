SELECT 行序, 物料编号, 物料名, 物料规格, 用量 FROM rd_asm_proc_detail WHERE 单据编号='AP-2026-10-0006' AND 表区=N'物料清单' ORDER BY id;
SELECT 行序, 子件编码, 子件名称, 子件规格, 标准用量 FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' ORDER BY 行序;
SELECT 单据编号, 行序, 物料种类, 物料编号, 物料名称, 实际添加比例, 单支物料含量, 设计添加量 FROM rd_mold_proc_detail WHERE 单据编号 IN ('MP-2026-10-0006','MP-2026-10-0007') AND 表区=N'配方表' ORDER BY 单据编号, id;
SELECT 单据编号, 产品编号, 产品名称, 版本号, 单据日期 FROM rd_mold_proc_head WHERE 单据编号 IN ('MP-2026-10-0006','MP-2026-10-0007')
