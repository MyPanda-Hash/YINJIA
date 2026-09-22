SET NOCOUNT ON;
SELECT N'1-台账索引现状' AS 段, i.name AS 索引名, i.is_unique AS 是否唯一, i.filter_definition AS 筛选条件,
       STUFF((SELECT N', ' + c.name FROM sys.index_columns ic JOIN sys.columns c
              ON c.object_id = ic.object_id AND c.column_id = ic.column_id
              WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
              ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 2, N'') AS 键列
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.yj_doc_batch') AND i.name IN ('UX_yj_doc_batch_no_active', 'IX_yj_doc_batch_no_active');

SELECT N'2-同订单同日共号可行性' AS 段, source_form_no AS 采购订单, batch_no AS 批次号, COUNT(*) AS 行数,
       MIN(id) AS 最小批次键, MAX(id) AS 最大批次键
FROM yj_doc_batch WHERE status = 'ACTIVE' AND batch_no IS NOT NULL
GROUP BY source_form_no, batch_no HAVING COUNT(*) > 1
ORDER BY 采购订单, 批次号;

SELECT N'3-列注明' AS 段, CAST(ep.value AS nvarchar(400)) AS batch_no说明
FROM sys.extended_properties ep
WHERE ep.major_id = OBJECT_ID('dbo.yj_doc_batch')
  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.yj_doc_batch'), 'batch_no', 'ColumnId')
  AND ep.name = 'MS_Description';
