SET NOCOUNT ON;
PRINT N'== 该笔领料的物料 S022-4 结存(服务器快照)==';
SELECT wzdm, ckdm, lot_no, rkl, ckl, yl, ISNULL(asp_cancel,'N') AS cancel FROM [HSDZ_MES_SRV1017].dbo.kucun WHERE wzdm = N'S022-4';
PRINT N'== outh 中该物料全部流水(服务器快照)==';
SELECT id, src, rid, 单据编号, 单据类型, 仓库编码, 批号, 数量, ISNULL(asp_cancel,'N') AS cancel FROM [HSDZ_MES_SRV1017].dbo.outh WHERE 物料编码 = N'S022-4';
PRINT N'== 同物料的入库流水 ==';
SELECT id, src, rid, 单据编号, 单据类型, 仓库编码, 批号, 数量 FROM [HSDZ_MES_SRV1017].dbo.inh WHERE 物料编码 = N'S022-4';
