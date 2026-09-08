-- migrate-prod-info-seed.sql -- 产品信息表(RD_PROD_INFO/rd_prod_info_head)种子:
-- 从《组装段BOM和工艺控制.docx》产品口径种入 2 个父件产品(T382 除重金属炭棒滤芯 / T382S 除重金属炭棒滤芯S)
-- 幂等:按 产品编号 判断,存在则跳过;先清理本脚本此前失败留下的残行(产品编号 为空)

DELETE FROM dbo.rd_prod_info_head
WHERE ([产品编号] IS NULL OR [产品编号] = '')
  AND [asp_user1] = 'migration';

INSERT INTO dbo.rd_prod_info_head
    ([单据编号], [单据日期], [产品编号], [产品名称], [产品类别], [产品类型], [产品整体尺寸], [客户料号], [炭棒尺寸], [特殊性能描述], [下单数量], [产品分类], [产品形态], [责任人], [审核人], [备注], [asp_user1], [asp_time1], [asp_cancel])
SELECT t.[单据编号], CONVERT(nvarchar(20), GETDATE(), 23), t.[产品编号], t.[产品名称], t.[产品类别], t.[产品类型], t.[产品整体尺寸], t.[客户料号], t.[炭棒尺寸], t.[特殊性能描述], t.[下单数量], t.[产品分类], t.[产品形态], t.[责任人], t.[审核人], t.[备注], 'migration', GETDATE(), 'N'
FROM (VALUES
    (N'CP382',  N'T382',  N'除重金属炭棒滤芯',   N'成品', N'炭棒滤芯', N'外径46mm 内径9.5mm 长度23mm', N'', N'外径28mm 内径11mm 长度195.5mm', N'去除水中重金属,出水重金属达标', N'1', N'家用终端', N'滤芯', N'陈秀丽', N'', N'组装段BOM和工艺控制.docx'),
    (N'CP382S', N'T382S', N'除重金属炭棒滤芯S', N'成品', N'炭棒滤芯', N'外径46mm 内径9.5mm 长度23mm', N'', N'外径28mm 内径11mm 长度195.5mm', N'去除水中重金属,加强型',       N'1', N'家用终端', N'滤芯', N'陈秀丽', N'', N'组装段BOM和工艺控制.docx')
) AS t([单据编号], [产品编号], [产品名称], [产品类别], [产品类型], [产品整体尺寸], [客户料号], [炭棒尺寸], [特殊性能描述], [下单数量], [产品分类], [产品形态], [责任人], [审核人], [备注])
WHERE NOT EXISTS (SELECT 1 FROM dbo.rd_prod_info_head h WHERE h.[产品编号] = t.[产品编号] AND ISNULL(h.[asp_cancel],'N') <> 'Y');

PRINT '产品信息表种子完成(2 个产品)';
