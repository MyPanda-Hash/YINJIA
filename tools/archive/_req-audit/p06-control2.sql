SET NOCOUNT ON;
PRINT N'=== 2. yj_doc_status 中 RD_* 各面板状态分布(按标志列推导) ===';
SELECT panel_code,
       COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(shr,'')<>'' THEN 1 ELSE 0 END) AS 已审核,
       SUM(CASE WHEN canceled='1' THEN 1 ELSE 0 END) AS 已取消审核,
       SUM(CASE WHEN pending='1' THEN 1 ELSE 0 END) AS 待审,
       SUM(CASE WHEN archived='1' THEN 1 ELSE 0 END) AS 已归档,
       SUM(CASE WHEN stopped='1' THEN 1 ELSE 0 END) AS 已中止,
       SUM(CASE WHEN ISNULL(saved,'')<>'' THEN 1 ELSE 0 END) AS 已保存,
       SUM(CASE WHEN ISNULL(modify_state,'')<>'' THEN 1 ELSE 0 END) AS 有修改申请
FROM yj_doc_status WHERE panel_code LIKE 'RD%' GROUP BY panel_code ORDER BY panel_code;
GO
PRINT N'=== 3. yj_form_approval 列 + RD_* 动作分布 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_form_approval' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== 4. yj_std_lib 列 + 内容分布 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_std_lib' ORDER BY ORDINAL_POSITION;
GO
SELECT COUNT(*) AS total FROM yj_std_lib;
GO
PRINT N'=== 5. rd_dev_task 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_dev_task' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== 6. yj_plan_term 行数/state ===';
SELECT state, COUNT(*) AS cnt FROM yj_plan_term GROUP BY state;
GO
PRINT N'=== 7. yj_panel.config 结构样例(3个面板) ===';
SELECT TOP 3 panel_code, CONVERT(NVARCHAR(MAX), config) AS cfg FROM yj_panel WHERE config IS NOT NULL;
