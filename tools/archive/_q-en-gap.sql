SET NOCOUNT ON;
DECLARE @labels TABLE(l nvarchar(100));
INSERT INTO @labels VALUES
(N'单据编号'),(N'单据日期'),(N'供应商'),(N'采购单号'),(N'产品名称'),(N'总数量'),(N'不合格品数量'),
(N'不合格品比例'),(N'不良说明'),(N'严重程度'),(N'特采理由'),(N'产品开发部性能意见'),(N'产品开发部工艺意见'),
(N'品质部意见'),(N'销售部意见'),(N'研发意见'),(N'最终处理结果'),(N'备注'),(N'单据状态'),(N'审核人'),
(N'审核时间'),(N'文档编号'),(N'编制人'),(N'特采单'),(N'来料品质'),
(N'严重'),(N'一般'),(N'轻微'),(N'正常使用'),(N'管控使用'),(N'挑选使用');
SELECT l.l AS label,
       ISNULL((SELECT text FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.l AND t.locale='en'), N'<缺>') AS field_en,
       ISNULL((SELECT text FROM yj_translation t WHERE t.scope='ui' AND t.ref_key=l.l AND t.locale='en'), N'<缺>') AS ui_en,
       ISNULL((SELECT text FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=l.l AND t.locale='en'), N'<缺>') AS panel_en
FROM @labels l;
GO
