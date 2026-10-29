SET NOCOUNT ON;
SELECT label, seq, required, hidden FROM dbo.yj_field
 WHERE panel_code = N'MATERIAL_OUT' AND place = N'header' ORDER BY seq;
SELECT N'--- 关键字段是否存在 ---' AS x;
SELECT label, place FROM dbo.yj_field
 WHERE panel_code = N'MATERIAL_OUT' AND label IN (N'加工单号', N'工单行号', N'仓位编码', N'仓位名称', N'批次号', N'批号', N'仓库', N'业务类型');
