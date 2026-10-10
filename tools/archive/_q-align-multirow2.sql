-- 多行字段里「两行内容不一致」的(这类字段上的无 place 限定 UPDATE 会误伤另一行)
SET NOCOUNT ON;
WITH c AS (
  SELECT RTRIM(panel_code) AS panel, RTRIM(col_name) AS col,
         CONCAT(place,'|',label,'|',data_type,'|',ISNULL(dict_sql,''),'|',ISNULL(ref_panel,''),'|',ISNULL(ref_field,''),
                '|',ISNULL(display_field,''),'|',seq,'|',ISNULL(width,''),'|',editable,'|',required,'|',hidden,'|',
                ISNULL(alias,''),'|',visible,'|',ISNULL(label_en,''),'|',ISNULL(col_group,''),'|',ISNULL(ref_filter,''),'|',ISNULL(tab_key,'')) AS canon
  FROM yj_field
  WHERE RTRIM(panel_code) IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
)
SELECT panel AS 面板, col AS 字段, COUNT(*) AS 行数, COUNT(DISTINCT canon) AS 不同内容行数
FROM c GROUP BY panel, col HAVING COUNT(*) > 1 AND COUNT(DISTINCT canon) > 1
ORDER BY panel, col;
GO
