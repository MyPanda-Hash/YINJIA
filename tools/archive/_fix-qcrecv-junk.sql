SET NOCOUNT ON;
/* QC_RECV 垃圾字段块(收敛期 qc-recv-fields 首跑灌入):用户点名 条码~折扣 隐藏+挪后 */
UPDATE yj_field SET hidden = 1, visible = 0, seq = 900 + (seq % 100)
 WHERE panel_code = 'QC_RECV' AND col_name IN (
   N'条码', N'发货数量', N'剩余数量', N'退料数量', N'报废数量',
   N'制单号', N'折扣金额', N'品质复核人', N'品质复核时间');
PRINT '已隐藏并挪后(条码~折扣块): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
SELECT seq, col_name, place, hidden, visible FROM yj_field WHERE panel_code='QC_RECV' AND hidden=0 ORDER BY seq;
GO
PRINT '== 链路批次号现状(5 面板) ==';
SELECT panel_code, col_name, place, seq, hidden, visible FROM yj_field
 WHERE col_name IN (N'批次号', N'批次键') AND panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','PURCHASE_IN','QC_RETURN')
 ORDER BY panel_code, place;
GO
