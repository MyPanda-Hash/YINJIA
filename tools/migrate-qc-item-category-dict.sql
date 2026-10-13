/* migrate-qc-item-category-dict.sql(2026-10-12):检验项目的「检验内容」升级为类别字典。
 *
 * 用户 2026-10-12 口径:「就是可以为当前页面创建一个新的项目设定,然后实现不同检验项目类别
 *   就能自动分格开来实现」—— 即 QC_ITEM.检验内容 作为「类别」(图里的 A外观/B尺寸/C性能/…),
 *   带入制程检验单明细时按它写进「表区」,实现自动分格。
 *
 * 本脚本:
 *   ① 给 QC_ITEM.检验内容 配下拉字典(现有值 + 常见类别),让类别标准化、可自定;
 *   ② 给制程检验单的「表区」也配同一套字典(手工补行时也能选到相同类别)。
 * 幂等:直接 UPDATE 字典 SQL(可重复执行);两账套均执行。
 */
SET NOCOUNT ON;
GO

/* ① QC_ITEM.检验内容 → 下拉框 + 字典 */
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql = N'SELECT v FROM (VALUES (N''目数''),(N''性能''),(N''卫生安全''),(N''外观''),(N''尺寸''),(N''重量''),(N''材质''),(N''包装''),(N''功能性测试'')) AS t(v)'
 WHERE panel_code = N'QC_ITEM' AND col_name = N'检验内容';
PRINT N'[OK] QC_ITEM.检验内容 已配字典,' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

/* ② 制程检验单.表区 → 同一套字典(手工补行时类别一致) */
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql = N'SELECT v FROM (VALUES (N''外观''),(N''尺寸''),(N''重量''),(N''材质''),(N''包装''),(N''功能性测试'')) AS t(v)'
 WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表区';
PRINT N'[OK] QC_PROC_INSP.表区 已配字典,' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

/* 自检 */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ITEM' AND col_name = N'检验内容'
                 AND data_type = N'下拉框' AND ISNULL(dict_sql,N'') <> N'') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表区'
                 AND data_type = N'下拉框' AND ISNULL(dict_sql,N'') <> N'') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'检验类别字典迁移自检失败', 16, 1);
ELSE PRINT N'检验类别字典就绪(QC_ITEM.检验内容 / QC_PROC_INSP.表区)';
GO
