SET NOCOUNT ON;
SELECT 表='inh', 行数=COUNT(*) FROM inh WHERE 批号='PC0000'
UNION ALL SELECT 'outh', COUNT(*) FROM outh WHERE 批号='PC0000'
UNION ALL SELECT 'kucun', COUNT(*) FROM kucun WHERE lot_no='PC0000'
UNION ALL SELECT 'inh 未填占位', COUNT(*) FROM inh WHERE 批号=N'(未填批号)'
UNION ALL SELECT 'outh 未填占位', COUNT(*) FROM outh WHERE 批号=N'(未填批号)'
UNION ALL SELECT 'kucun 未填占位', COUNT(*) FROM kucun WHERE lot_no=N'(未填批号)';
