SELECT TOP 5 单据编号, 单据日期, 客户名称, 产品编码, 产品名称, 问题来源, 处理意见, 单据状态 FROM qc_bhc ORDER BY id DESC
GO
SELECT TOP 5 单据编号, 单据日期, 物料编码, 物料批次, 问题来源, 处理意见, 单据状态 FROM qc_bhz ORDER BY id DESC
GO
SELECT TOP 5 单据编号, 单据日期, 物料类型, 物料编码, 批次号, 单据状态 FROM qc_jjf ORDER BY id DESC
GO
SELECT TOP 5 单据编号, 单据日期, 供应商, 物料批次, 物料编码, 处理方式, 单据状态 FROM qc_lyb ORDER BY id DESC
GO
SELECT TOP 5 单据编号, 单据日期, 客户名称, 产品名称, 填写部门, 责任部门, 异常等级, 单据状态 FROM qc_bhg ORDER BY id DESC
