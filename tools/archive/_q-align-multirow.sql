-- 检查:四单里「同一 (panel, col_name) 有多行」的字段(这些字段上的无 place 限定的 UPDATE 会误伤)
SET NOCOUNT ON;
SELECT RTRIM(panel_code) AS 面板, RTRIM(col_name) AS 字段, COUNT(*) AS 行数,
       STRING_AGG(CAST(place AS varchar(60)), ' | ') AS 各处place
FROM yj_field
WHERE RTRIM(panel_code) IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
GROUP BY panel_code, col_name HAVING COUNT(*) > 1
ORDER BY panel_code, col_name;
GO
