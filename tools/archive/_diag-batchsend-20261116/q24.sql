SET NOCOUNT ON;
SELECT 'sl_recv_detail.采购订单行号' AS col, CASE WHEN COL_LENGTH('dbo.sl_recv_detail',N'采购订单行号') IS NULL THEN N'缺' ELSE N'有' END AS v
UNION ALL SELECT 'qc_insp_detail.采购订单行号', CASE WHEN COL_LENGTH('dbo.qc_insp_detail',N'采购订单行号') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'qc_return_detail.采购订单行号', CASE WHEN COL_LENGTH('dbo.qc_return_detail',N'采购订单行号') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'bl_purchase_in.源单行号', CASE WHEN COL_LENGTH('dbo.bl_purchase_in',N'源单行号') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'bl_purchase_in.源单编号', CASE WHEN COL_LENGTH('dbo.bl_purchase_in',N'源单编号') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'bl_pu_label.采购订单行号', CASE WHEN COL_LENGTH('dbo.bl_pu_label',N'采购订单行号') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'bl_pu_label.采购订单行id', CASE WHEN COL_LENGTH('dbo.bl_pu_label',N'采购订单行id') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'bd_pu_label.采购订单号', CASE WHEN COL_LENGTH('dbo.bd_pu_label',N'采购订单号') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'form_flow_link.source_line_key', CASE WHEN COL_LENGTH('dbo.form_flow_link',N'source_line_key') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'bl_pu_order.行号', CASE WHEN COL_LENGTH('dbo.bl_pu_order',N'行号') IS NULL THEN N'缺' ELSE N'有' END
UNION ALL SELECT 'bl_so_order.行号', CASE WHEN COL_LENGTH('dbo.bl_so_order',N'行号') IS NULL THEN N'缺' ELSE N'有' END;
