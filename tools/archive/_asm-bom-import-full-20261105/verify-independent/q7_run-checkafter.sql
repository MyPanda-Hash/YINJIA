SET NOCOUNT ON;
-- 直接执行包内 CHECK-after.sql 的四条语句(原样原文,只读)
SELECT 'rows=' + CAST(COUNT(*) AS varchar(20))
     + ' docs=' + CAST(COUNT(DISTINCT 单据编号) AS varchar(20))
     + ' prods=' + CAST(COUNT(DISTINCT 产品编码) AS varchar(20))
     + ' missing_unit=' + CAST(SUM(CASE WHEN ISNULL(计量单位, N'') = N'' THEN 1 ELSE 0 END) AS varchar(20))
     + ' bad_seq_docs=' + CAST((
           SELECT COUNT(*) FROM (
             SELECT 单据编号 FROM dbo.bs_asm_bom
              WHERE 来源 = N'金蝶BOM引出列表_20261019174847'
              GROUP BY 单据编号
             HAVING MIN(行序) <> 1 OR MAX(行序) <> COUNT(*) OR COUNT(DISTINCT 行序) <> COUNT(*)
           ) x) AS varchar(20))
  FROM dbo.bs_asm_bom
 WHERE 来源 = N'金蝶BOM引出列表_20261019174847';
GO
SELECT 'schema_log=' + CAST((
         SELECT COUNT(*) FROM yj_schema_log
          WHERE script_name = 'migrate-asm-bom-data-full-20261105.sql') AS varchar(20))
     + ' multi_version_products=' + CAST((
         SELECT COUNT(*) FROM (
           SELECT 产品编码 FROM dbo.bs_asm_bom
            WHERE 来源 = N'金蝶BOM引出列表_20261019174847'
            GROUP BY 产品编码 HAVING COUNT(DISTINCT 单据编号) = 2
         ) x) AS varchar(20))
     + ' other_source_rows=' + CAST((
         SELECT COUNT(*) FROM dbo.bs_asm_bom
          WHERE ISNULL(来源, N'') <> N'金蝶BOM引出列表_20261019174847') AS varchar(20));
GO
SELECT 'panel_docs=' + CAST(COUNT(DISTINCT 单据编号) AS varchar(20))
  FROM dbo.bs_asm_bom
 WHERE ISNULL(asp_cancel, 'N') <> 'Y';
GO
