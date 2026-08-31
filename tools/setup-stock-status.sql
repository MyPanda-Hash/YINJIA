/* STOCK_STATUS 库存状况面板(flat 平表模式,读 kucun 库存台账)
   标签对齐 light-mes fillCurrentStock 契约(存货编码/存货/仓库/现存量(主)) */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
DELETE FROM yj_field WHERE panel_code = 'STOCK_STATUS';
DELETE FROM yj_panel WHERE panel_code = 'STOCK_STATUS';
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size) VALUES
('STOCK_STATUS', N'库存状况', N'报表', 'flat', 'kucun', NULL, NULL, 'id', NULL, NULL, NULL, 100);
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, required) VALUES
('STOCK_STATUS','wzdm',N'存货编码','文本','query,detail',1,0),
('STOCK_STATUS','wzdm',N'存货','文本','detail',2,0),
('STOCK_STATUS','ckdm',N'仓库','文本','query,detail',3,0),
('STOCK_STATUS','lot_no',N'批号','文本','query,detail',4,0),
('STOCK_STATUS','khdm',N'客户代码','文本','query,detail',5,0),
('STOCK_STATUS','rkl',N'累计入库量','小数','detail',6,0),
('STOCK_STATUS','ckl',N'累计出库量','小数','detail',7,0),
('STOCK_STATUS','yl',N'现存量(主)','小数','detail',8,0),
('STOCK_STATUS','yl2',N'辅助结余','小数','detail',9,0),
('STOCK_STATUS','in_date',N'入库日期','日期','detail',10,0);
GO
DECLARE @fc int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='STOCK_STATUS');
PRINT N'STOCK_STATUS 注册完成: ' + CAST(@fc AS nvarchar(10)) + N' 字段';
GO
