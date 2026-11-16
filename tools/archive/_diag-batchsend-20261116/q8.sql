SET NOCOUNT ON;
SELECT GETDATE() AS now_server;
GO
PRINT '== current line rows: id + asp_time1 (insert time of sync) ==';
SELECT id, 行号, 物料编码, 数量, asp_user1, asp_time1, asp_cancel FROM bl_pu_order WHERE 单据编号 = N'YJ-20261111-06' ORDER BY id;
GO
PRINT '== head sync times ==';
SELECT id, 单据编号, 数据来源, 单据状态, 审核人, 审核时间, asp_user1, asp_time1, asp_user2, asp_time2, 外部数据ID, 外部指纹 FROM bd_pu_order WHERE 单据编号 = N'YJ-20261111-06';
GO
PRINT '== links around batch 20261116 ==';
SELECT id, source_form_no, source_line_key, target_form_no, linked_quantity, link_status, batch_no, create_by, create_time
FROM form_flow_link WHERE batch_no = N'20261116' ORDER BY id;
