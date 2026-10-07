-- _q-merge-lab-dates.sql — 合并后:实验室记录表日期/时间格迁移是否生效(只读)
SET NOCOUNT ON;
PRINT '=== 应为「日期」的字段(迁移后) ===';
SELECT panel_code, label, data_type FROM yj_field
WHERE panel_code IN (N'RD_INSTR_USE', N'RD_EQUIP_USE', N'RD_DOM_TEST', N'RD_SPIKE_WATER', N'RD_SCALE',
                     N'RD_MINERAL', N'RD_ANTIBACT', N'RD_RO_PROTECT', N'RD_SOAK', N'RD_DROP_PREC', N'RD_ALKALINE')
  AND label IN (N'使用日期', N'测试日期', N'日期', N'期望完成日期', N'预计完成日期', N'起止时间')
ORDER BY panel_code, label;
PRINT '=== 迁移后仍应为「文本」的四个测试时间格(用户口径保持文本) ===';
SELECT panel_code, label, place, data_type FROM yj_field
WHERE label = N'测试时间' AND panel_code LIKE N'RD[_]%' ORDER BY panel_code, place;
