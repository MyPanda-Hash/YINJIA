SET NOCOUNT ON;
SELECT 'plang' t, COUNT(*) n FROM plang WHERE RTRIM(pl_no) LIKE 'GD-2026-10-[0-9][0-9][0-9][0-9]'
UNION ALL SELECT 'plang_pc', COUNT(*) FROM plang_pc pc WHERE EXISTS (SELECT 1 FROM plang p WHERE p.id=pc.plang_id AND RTRIM(p.pl_no) LIKE 'GD-2026-10-[0-9][0-9][0-9][0-9]')
UNION ALL SELECT 'bd_manu_order', COUNT(*) FROM bd_manu_order WHERE RTRIM(合同号) LIKE 'GD-2026-10-[0-9][0-9][0-9][0-9]'
UNION ALL SELECT 'wo_order', COUNT(*) FROM wo_order WHERE RTRIM(单据编号) LIKE 'GD-2026-10-[0-9][0-9][0-9][0-9]'
UNION ALL SELECT 'bl_manu_order', COUNT(*) FROM bl_manu_order WHERE RTRIM(合同号) LIKE 'GD-2026-10-[0-9][0-9][0-9][0-9]';
SELECT TOP 3 pl_no, pl_date, mc FROM plang ORDER BY pl_no DESC;
