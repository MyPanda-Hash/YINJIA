SET NOCOUNT ON;
-- 存档留痕:还有哪些"一次删掉很多行"的记录(排查同类误删)
SELECT id, panel_code, user_name AS 操作人, CONVERT(varchar(19), saved_at, 120) AS 保存时间,
       JSON_VALUE(change_meta, '$.removedRows') AS 移除行数,
       JSON_VALUE(change_meta, '$.changedRows') AS 修改行数,
       JSON_VALUE(change_meta, '$.addedRows') AS 新增行数,
       JSON_VALUE(change_meta, '$.removedSamples[0]') AS 首个被删示例
FROM dbo.yj_archive_change_log
WHERE ISNUMERIC(JSON_VALUE(change_meta, '$.removedRows')) = 1
  AND CAST(JSON_VALUE(change_meta, '$.removedRows') AS int) > 0
ORDER BY CAST(JSON_VALUE(change_meta, '$.removedRows') AS int) DESC;
GO
