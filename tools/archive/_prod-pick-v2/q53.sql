SET NOCOUNT ON;
SELECT TOP 3 单据编号, 业务类型, ISNULL(退料标志,'<NULL>') 退料标志, ISNULL(备注,'') 备注 FROM bd_other_in WHERE 业务类型='生产退料' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
