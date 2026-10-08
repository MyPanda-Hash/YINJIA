-- 危险判定:多行字段里「忽略 place 后两行仍不同」的(这类字段上无 place 限定的 UPDATE 真的会误伤)
SET NOCOUNT ON;
WITH c AS (
  SELECT RTRIM(panel_code) AS panel, RTRIM(col_name) AS col,
         CONCAT(label,'|',data_type,'|',ISNULL(dict_sql,''),'|',ISNULL(ref_panel,''),'|',ISNULL(ref_field,''),
                '|',ISNULL(display_field,''),'|',seq,'|',ISNULL(width,''),'|',editable,'|',required,'|',hidden,'|',
                ISNULL(alias,''),'|',visible,'|',ISNULL(label_en,''),'|',ISNULL(col_group,''),'|',ISNULL(ref_filter,''),'|',ISNULL(tab_key,'')) AS canon_no_place
  FROM yj_field
  WHERE RTRIM(panel_code) IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
)
SELECT panel AS 面板, col AS 字段, COUNT(*) AS 行数, COUNT(DISTINCT canon_no_place) AS 忽略place后不同内容行数
FROM c GROUP BY panel, col HAVING COUNT(*) > 1 AND COUNT(DISTINCT canon_no_place) > 1
ORDER BY panel, col;
GO
PRINT '=== QC_RECV.仓库 两行的 18 属性(看差异到底在哪) ===';
GO
SELECT id, place, seq, hidden, visible, label FROM yj_field
WHERE RTRIM(panel_code)='QC_RECV' AND col_name=N'仓库' ORDER BY id;
GO
