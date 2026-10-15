/* migrate-rd-approval-attach-20261016.sql
 * 立项申请表(RD_APPROVAL)加「附件」能力(用户口径 2026-10-16:「给立项申请表的备注栏加一个
 * 可以上传附件的功能」)。
 *
 * 【为什么这么加】
 *   本仓附件是**元数据驱动**的,不需要改渲染代码:
 *     · yj_field 里 data_type = N'附件' 的字段,会被 PanelxList/PanelxForm 自动收进「附件条」
 *       (attachFields = headerFields.filter(f => f.dataType === '附件')),
 *       由 FileAttachCell.vue 渲染「上传附件 / 点击查看 / 删除」;
 *     · 文件本体存 **yj_attachment**(panel_code,doc_no,field_key,file_name,stored_name,…),
 *       **不进业务表**;业务表的 附件N 列只是占位/历史列。
 *   所以本面板只需:① 补物理占位列(权威约定,且 selectCols 会按 col_name 出列,缺列会报"列名无效")
 *   ② 登记一行 yj_field(data_type='附件')。译名 N'附件1' 十语言**已存在**,无需新增。
 *
 * 【登记形态(照抄 SO_ORDER.附件1)】
 *   col_name=N'附件1' · label=N'附件1' · data_type=N'附件' · place='header' · seq=167(紧跟备注 165)
 *   · width=220 · editable=1 · required=0 · hidden=0 · visible=1
 *   物理列 rd_approval.[附件1] nvarchar(1000) NULL(与 bd_so_order.附件1 同型)。
 *
 * 【幂等】建列走 COL_LENGTH 判空;注明走 extended_properties 判空;字段行走 NOT EXISTS。
 *   末尾自检:列在 + 字段行恰好 1 行 + data_type 正确,否则 RAISERROR。
 * 【执行】两账套各跑一遍(先 HSDZ_MES 后 HSDZ_MES_TEST),跑到「执行 0、失败 0」。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- ① 物理占位列
IF COL_LENGTH(N'rd_approval', N'附件1') IS NULL
BEGIN
  ALTER TABLE dbo.rd_approval ADD [附件1] nvarchar(1000) NULL;
  PRINT N'   [新增列] rd_approval.附件1 nvarchar(1000) NULL';
END
ELSE PRINT N'   [跳过] rd_approval.附件1 列已存在';

-- ② 中文注明(AGENTS:改已有表结构鼓励补注)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.rd_approval')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.rd_approval'), N'附件1', 'ColumnId')
                  AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'备注栏附件占位列(文件本体存 yj_attachment;本列仅占位/历史兼容)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_approval', N'COLUMN', N'附件1';
ELSE PRINT N'   [跳过] 该列注明已存在';

-- ③ yj_field 登记(data_type='附件' ⇒ 自动进附件条)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_APPROVAL' AND col_name = N'附件1')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('RD_APPROVAL', N'附件1', N'附件1', N'附件', N'header', 167, 220, 1, 0, 0, 1);
  PRINT N'   [新增字段] RD_APPROVAL.附件1(data_type=附件,seq=167)';
END
ELSE PRINT N'   [跳过] 该字段已登记';
GO

PRINT N'== 自检 ==';
DECLARE @bad int = 0;
IF COL_LENGTH(N'rd_approval', N'附件1') IS NULL
BEGIN PRINT N'   [X] 物理列缺失'; SET @bad = @bad + 1; END
DECLARE @n int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'RD_APPROVAL' AND col_name = N'附件1');
IF @n <> 1
BEGIN PRINT N'   [X] yj_field 登记行数 = ' + CAST(@n AS nvarchar(10)) + N'(应 1)'; SET @bad = @bad + 1; END
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_APPROVAL' AND col_name = N'附件1' AND data_type = N'附件')
BEGIN PRINT N'   [X] data_type 不是 附件'; SET @bad = @bad + 1; END
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_APPROVAL' AND col_name = N'附件1' AND place = N'header' AND visible = 1)
BEGIN PRINT N'   [X] 可见性/位置不对(应 header + visible=1)'; SET @bad = @bad + 1; END
IF @bad > 0 RAISERROR(N'[自检] 立项申请附件登记不完整', 16, 1);
ELSE PRINT N'   [OK] 立项申请表附件能力已就位(元数据驱动,前端自动出「附件条」)';
GO

PRINT N'== 当前 RD_APPROVAL 表头字段(含附件) ==';
SELECT id, label, col_name, data_type, seq, visible FROM yj_field
 WHERE panel_code = 'RD_APPROVAL' AND place = 'header'
 ORDER BY seq, id;
GO
