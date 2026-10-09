SET NOCOUNT ON;
PRINT N'=== 1. bs_wh 可选仓库(原材料区(A仓) 该挂哪个) ===';
SELECT id, 仓库编码, 仓库名称 FROM dbo.bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 仓库编码;
GO
PRINT N'=== 2. WHLOC 面板现有字段(将追加层次列) ===';
SELECT id, col_name, label, data_type, place, seq, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code='WHLOC' ORDER BY seq, id;
GO
PRINT N'=== 3. 待新增字段标签 是否已有全局译名(避免 uq_translation 撞键) ===';
SELECT ref_key, scope, locale, text FROM yj_translation
WHERE ref_key IN (N'仓位名称', N'厂区', N'库区', N'排号', N'位号', N'仓位类型')
ORDER BY ref_key, scope, locale;
GO
PRINT N'=== 4. 这些标签是否已被别的面板用作字段(同名共享译名) ===';
SELECT panel_code, col_name, label FROM yj_field
WHERE label IN (N'仓位名称', N'厂区', N'库区', N'排号', N'位号', N'仓位类型') ORDER BY label, panel_code;
GO
PRINT N'=== 5. 目标列是否已存在(幂等判据) ===';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc')
  AND name IN (N'厂区', N'库区', N'排号', N'位号', N'仓位名称') ORDER BY name;
GO
PRINT N'=== 6. 现有仓位数据(避免编码撞车) ===';
SELECT id, 仓库, 仓库编码, 仓位编码, 仓位地址 FROM dbo.bs_wh_loc ORDER BY id;
GO
PRINT N'=== 7. yj_locale 语言清单(译名要覆盖哪些) ===';
SELECT code, name_cn, enabled FROM yj_locale ORDER BY sort_order;
GO
