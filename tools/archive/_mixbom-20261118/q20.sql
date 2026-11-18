SELECT 单据编号,产品编码,产品名称,版本号,默认BOM,来源,状态,行序,子件编码,子件名称,子件规格,计量单位,标准用量 FROM bs_asm_bom WHERE 产品编码 LIKE 'E2EASM-%' ORDER BY 单据编号, 行序;
SELECT 单据编号,产品编号,产品名称,烧结类型,来源单号,版本号,状态,行序,物料种类,物料编号,物料名称,添加比例,单支含量g,设计添加量 FROM bs_mix_bom WHERE 产品编号 LIKE 'E2EMIX-%' OR 产品编号 LIKE 'E2EXS-%' ORDER BY 单据编号, 行序;
SELECT COUNT(*) asm_total FROM bs_asm_bom;
SELECT COUNT(*) mix_total FROM bs_mix_bom;
