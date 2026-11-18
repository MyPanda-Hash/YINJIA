SELECT 单据编号, 表区, 序号, 物料种类, 物料编号, 物料名称, 实际添加比例, 单支物料含量, 设计添加量, asp_cancel FROM rd_mold_proc_detail WHERE 单据编号 IN ('MP-2026-10-0006','MP-2026-10-0007') ORDER BY 单据编号, id;
SELECT COUNT(*) AS mix_rows FROM bs_mix_bom;
SELECT COUNT(*) AS asm_rows_c23 FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001';
SELECT 行序,子件编码,子件名称,标准用量,来源 FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' ORDER BY 行序;
