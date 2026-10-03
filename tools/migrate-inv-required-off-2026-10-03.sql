-- migrate-inv-required-off-2026-10-03.sql
-- 用户口径(2026-10-03):「商品不要任意设置字段为必填」。
-- 背景:yj_field 里 INV(商品)面板有 3 个字段 required=1(所属类别/存货编码/存货名称,seq 10/20/30,
--   来自最初的 db/HSDZ_MES.sql 种子)。而商品档案是金蝶同步来的 3874 行,「所属类别」等常有空值;
--   前端 validateInlineDraft 对档案面板**逐行 × 逐必填字段**全量校验 ⇒ 只要任意一行缺这几个字段,
--   整个面板的保存就被挡住(报「明细第 N 行X不能为空」),改一行也存不下去。
-- 本脚本:把 INV 面板的必填全部取消(required=0)。其它面板的必填一律不动。
-- 幂等:重跑影响 0 行;两个账套都执行(测试库为快照,同名行同样处理)。
SET NOCOUNT ON;

DECLARE @before int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code='INV' AND ISNULL(required,0) <> 0);
PRINT N'[' + DB_NAME() + N'] INV 面板改前必填字段数:' + CAST(@before AS nvarchar(10));

UPDATE dbo.yj_field SET required = 0
 WHERE panel_code = 'INV' AND ISNULL(required,0) <> 0;

DECLARE @after int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code='INV' AND ISNULL(required,0) <> 0);
DECLARE @total int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code='INV');
PRINT N'[' + DB_NAME() + N'] INV 面板改后必填字段数:' + CAST(@after AS nvarchar(10))
    + N'(共 ' + CAST(@total AS nvarchar(10)) + N' 个字段)';
IF @after <> 0 RAISERROR(N'商品面板仍有必填字段,未清干净', 16, 1);
GO
