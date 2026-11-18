SET NOCOUNT ON;
DELETE FROM dbo.bl_finish_in WHERE 单据编号 = N'FI-UI-QTY-01';
DELETE FROM dbo.yj_form_approval WHERE panel_code=N'FINISH_IN' AND form_no=N'FI-UI-QTY-01';
DELETE FROM dbo.yj_doc_status WHERE panel_code=N'FINISH_IN' AND doc_no=N'FI-UI-QTY-01';
DELETE FROM dbo.bd_finish_in WHERE 单据编号 = N'FI-UI-QTY-01';
INSERT INTO dbo.bd_finish_in (单据编号, 单据日期, 业务类型, 加工单号, 工单行号, 批次号, 仓库, 经手人, 备注)
VALUES (N'FI-UI-QTY-01', CAST(GETDATE() AS date), N'产成品入库', N'GD-UI-QTY', 1, N'20261118', N'C仓', N'admin', N'界面取证:不合格数量列(验完删除)');
INSERT INTO dbo.bl_finish_in (单据编号, 产品编码, 产品名称, 仓库, 计量单位, 实收数量, 批号, 序号, 不合格数量)
VALUES (N'FI-UI-QTY-01', N'C-95-43', N'1217项目/后置副龙头芯', N'C仓', N'支', 4, N'20261118', 1, 2);
SELECT 单据编号, 产品编码, 实收数量, 不合格数量 FROM dbo.bl_finish_in WHERE 单据编号=N'FI-UI-QTY-01';
