SELECT 'docs' t, COUNT(DISTINCT 单据编号) n FROM bs_asm_bom UNION ALL SELECT 't410', COUNT(*) FROM bs_asm_bom WHERE 单据编号 LIKE 'T410%' UNION ALL SELECT 'c23', COUNT(*) FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' UNION ALL SELECT 'bomnov', COUNT(*) FROM bs_asm_bom WHERE 单据编号='BOM-2026-11-0002';
SELECT TOP 3 单据编号, 产品编码, 来源 FROM bs_asm_bom ORDER BY 单据编号 DESC;
