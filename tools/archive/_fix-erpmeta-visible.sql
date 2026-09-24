SET NOCOUNT ON;
/* 转ERP 四字段改显示(采购入库/销售出库,用户口径:这些记录要看得见) */
UPDATE yj_field SET hidden = 0, visible = 1
 WHERE panel_code IN ('PURCHASE_IN','SALE_OUT')
   AND col_name IN (N'是否已转ERP', N'ERP单号', N'转ERP操作人', N'转ERP时间');
PRINT '转ERP四字段已显示: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
SELECT panel_code, col_name, place, hidden, visible FROM yj_field
 WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND col_name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间')
 ORDER BY panel_code, col_name;
GO
