SET NOCOUNT ON;
SELECT 单据编号, 业务类型, ISNULL(退料标志,'<null>') 退料标志, CONVERT(varchar(19),单据日期,120) 日期, ISNULL(备注,'') 备注 FROM bd_other_in WHERE 单据编号 IN ('OI-2026-10-0006','OI-2026-10-0007');
GO
SELECT 单据编号, 存货编码, 数量, 仓库, ISNULL(明细备注,'') FROM bl_other_in WHERE 单据编号 IN ('OI-2026-10-0006','OI-2026-10-0007') ORDER BY 单据编号, 序号;
GO
SELECT panel_code, doc_no, ISNULL(shr,'') 审核人 FROM yj_doc_status WHERE doc_no IN ('OI-2026-10-0006','OI-2026-10-0007');
GO
SELECT 存货编码, 仓库, 现存量 FROM v_stock_pick WHERE 存货编码 IN ('YJ-ZZ-001','YJ-KBL-012') AND 仓库='恒亿仓';
GO
SELECT 领料单号, 物料编码, 退料数量, 退料单号 FROM wo_pick_return ORDER BY id;
GO
SELECT 工单号, 状态, ISNULL(退料单号,'') 退料单号 FROM wo_pick_doc WHERE 领料单号='LL-2026-10-0006';
