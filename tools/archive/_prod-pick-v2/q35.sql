SET NOCOUNT ON;
SELECT COUNT(*) 退料台账列数 FROM sys.columns WHERE object_id=OBJECT_ID('wo_pick_return');
GO
SELECT 单据编号, ISNULL(退料标志,'<null>') 标志, ISNULL(asp_cancel,'N') 作废 FROM bd_other_in WHERE 业务类型='生产退料' ORDER BY id DESC;
