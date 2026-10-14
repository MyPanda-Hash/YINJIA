-- _q-multiline-type.sql — 「多行文本」字段类型落地核对(两账套各跑一遍)
SET NOCOUNT ON;
SELECT DB_NAME() AS 库,
       SUM(CASE WHEN data_type = N'多行文本' THEN 1 ELSE 0 END) AS 多行文本行数,
       SUM(CASE WHEN data_type = N'文本' AND label IN (N'表区', N'行号', N'数量') THEN 1 ELSE 0 END) AS 短列仍单行
FROM dbo.yj_field
WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') AND place LIKE N'%detail%';

SELECT panel_code, label, data_type, seq
FROM dbo.yj_field
WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
  AND place LIKE N'%detail%'
  AND label IN (N'处理方式', N'备注', N'检验项目', N'标准要求', N'实测数值', N'检验方法', N'判定', N'表区', N'行号', N'数量')
ORDER BY panel_code, seq;

-- 全库该类型的使用面(应仅这三面板 21 行)
SELECT COUNT(*) AS 全库多行文本字段数 FROM dbo.yj_field WHERE data_type = N'多行文本';
