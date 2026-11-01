/* 补验 E 的静态/配置证据(只读):成型报工审核要写入的两张现役检验单,面板配置与头表是否自洽 */
SET NOCOUNT ON;
SELECT panel_code, ISNULL(panel_name,N'') AS panel_name, ISNULL(head_table,N'') AS head_table,
       ISNULL(group_col,N'') AS group_col, ISNULL(mode,N'') AS mode
  FROM dbo.yj_panel WHERE panel_code IN (N'QC_FIRST_INSP', N'QC_PROC_INSP', N'QC_ASM_INSP');
GO
SELECT N'面板头表存在(1/0)' AS 项,
       (SELECT CASE WHEN OBJECT_ID(N'dbo.' + head_table, N'U') IS NULL THEN 0 ELSE 1 END FROM dbo.yj_panel WHERE panel_code=N'QC_FIRST_INSP') AS 首件,
       (SELECT CASE WHEN OBJECT_ID(N'dbo.' + head_table, N'U') IS NULL THEN 0 ELSE 1 END FROM dbo.yj_panel WHERE panel_code=N'QC_PROC_INSP') AS 制程,
       (SELECT CASE WHEN OBJECT_ID(N'dbo.' + head_table, N'U') IS NULL THEN 0 ELSE 1 END FROM dbo.yj_panel WHERE panel_code=N'QC_ASM_INSP') AS 组装;
GO
