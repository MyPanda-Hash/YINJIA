SELECT COUNT(*) asm_total FROM bs_asm_bom;
SELECT COUNT(*) mix_total FROM bs_mix_bom;
SELECT COUNT(*) mix_docs FROM (SELECT DISTINCT 单据编号 FROM bs_mix_bom) x;
SELECT COUNT(*) asm_c23 FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001'
