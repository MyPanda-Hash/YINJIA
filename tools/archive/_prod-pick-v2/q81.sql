SET NOCOUNT ON;
SELECT id, 工单号, 领料单号, ISNULL(退料单号,'(已清空)') 退料单号, 状态 FROM wo_pick_doc ORDER BY id;
