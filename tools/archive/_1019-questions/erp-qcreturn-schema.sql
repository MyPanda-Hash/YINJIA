-- 只读调研:暂收退回单 QC_RETURN 表结构与转ERP 数据可得性
SET NOCOUNT ON;
GO
PRINT '=== 1. qc_return 列清单 ==='
GO
SELECT c.column_id, c.name AS 列名, t.name AS 类型, c.max_length AS 长度,
       c.is_nullable AS 可空, ISNULL(ep.value, '') AS 中文注明
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('dbo.qc_return')
ORDER BY c.column_id;
GO
PRINT '=== 2. qc_return_detail 列清单 ==='
GO
SELECT c.column_id, c.name AS 列名, t.name AS 类型, c.max_length AS 长度,
       c.is_nullable AS 可空, ISNULL(ep.value, '') AS 中文注明
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('dbo.qc_return_detail')
ORDER BY c.column_id;
GO
PRINT '=== 3. 行数(头/行) ==='
GO
SELECT (SELECT COUNT(*) FROM dbo.qc_return) AS qc_return_行数,
       (SELECT COUNT(*) FROM dbo.qc_return_detail) AS qc_return_detail_行数;
GO
PRINT '=== 4. 单据状态分布(合并 yj_doc_status) ==='
GO
SELECT ISNULL(h.单据状态, N'(空)') AS 单据状态,
       CASE WHEN s.shr IS NULL THEN N'未审核' ELSE N'已审核' END AS 审批,
       COUNT(*) AS 单据数
FROM dbo.qc_return h
LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RETURN' AND s.doc_no = h.单据编号
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
GROUP BY ISNULL(h.单据状态, N'(空)'), CASE WHEN s.shr IS NULL THEN N'未审核' ELSE N'已审核' END
ORDER BY 1, 2;
GO
PRINT '=== 5. 已审核单据 + 明细行数(可直接实推验证的候选) ==='
GO
SELECT h.单据编号, CONVERT(varchar(10), h.单据日期, 23) AS 单据日期, h.供应商, h.批次号, h.仓库,
       ISNULL(h.退货类型, N'') AS 退货类型, s.shr AS 审核人,
       (SELECT COUNT(*) FROM dbo.qc_return_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N') <> 'Y') AS 明细行,
       (SELECT SUM(d.退货数量) FROM dbo.qc_return_detail d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N') <> 'Y') AS 退货数量合计
FROM dbo.qc_return h
INNER JOIN yj_doc_status s ON s.panel_code = 'QC_RETURN' AND s.doc_no = h.单据编号 AND s.shr IS NOT NULL
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
ORDER BY h.单据编号 DESC;
GO
PRINT '=== 6. 明细样例(前 30 行,看物料/单位/仓库/批号/源单号是否可用) ==='
GO
SELECT TOP 30 d.单据编号, d.物料编码, d.物料名称, d.退货数量, d.计量单位, d.单价,
       ISNULL(d.批次号, N'') AS 批号, ISNULL(d.采购订单行号,'') AS 源单行号, ISNULL(d.报废数量,0) AS 报废数量
FROM dbo.qc_return_detail d
ORDER BY d.单据编号 DESC, d.id ASC;
GO
PRINT '=== 7. yj_field 登记(QC_RETURN,表头/明细) ==='
GO
SELECT f.seq, f.place, f.label AS 字段名, f.visible, f.hidden, ISNULL(f.ref_panel,'') AS 参照面板,
       ISNULL(f.ref_field,'') AS 参照字段
FROM yj_field f
WHERE f.panel_code = 'QC_RETURN'
ORDER BY f.place, f.seq, f.id;
GO
PRINT '=== 8. yj_panel 登记(QC_RETURN) ==='
GO
SELECT panel_code, panel_name, category, module_group, table_name, config
FROM yj_panel WHERE panel_code = 'QC_RETURN';
GO
