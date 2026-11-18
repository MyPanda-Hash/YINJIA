SELECT 行序,子件编码,子件名称,子件规格,计量单位,标准用量,来源 FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' ORDER BY 行序;
SELECT 单据编号,产品编号,产品名称,烧结类型,来源单号,行序,物料种类,物料编号,物料名称,添加比例,单支含量g,设计添加量 FROM bs_mix_bom ORDER BY 单据编号, 行序;
SELECT COUNT(*) docs FROM (SELECT DISTINCT 单据编号 FROM bs_mix_bom) x;
