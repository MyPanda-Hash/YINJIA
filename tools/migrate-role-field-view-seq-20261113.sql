/* ============================================================================
   migrate-role-field-view-seq-20261113.sql —— 角色字段视图加「序号」
   ----------------------------------------------------------------------------
   用户口径(2026-11-13 第二轮,在原功能上追加):
     「只存显隐,也可调整位置,并且这个字段排序,可以用序号来调整位置,
       只有勾选的字段了才有序号」
     「角色模板:从整体一键复制 / 套用到另一个角色」

   因此 yj_field_view 增 1 列:
     seq int NULL —— 本角色内该字段的位置(1..n,只对**勾选(显示)**的字段有值;
                    隐藏字段为 NULL)。NULL 的两种含义在读取侧区分处理:
                      · 该字段有覆盖行但 shown=0  → 隐藏,不参与排序;
                      · 该字段根本没有覆盖行      → 未定制,按系统整体顺序排在
                                                  已编号字段之后(新字段默认落末尾)
   仍然**不碰 yj_field 一个字节**;仍只做角色层,不细到个人。
   ============================================================================ */
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;

IF COL_LENGTH('dbo.yj_field_view', 'seq') IS NULL
BEGIN
    ALTER TABLE dbo.yj_field_view ADD seq int NULL;
    PRINT N'[新增列] yj_field_view.seq';
END
ELSE
    PRINT N'[跳过] yj_field_view.seq 已存在';
GO

/* 列级中文注明(缺才补,不覆盖) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.yj_field_view')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_field_view'), N'seq', 'ColumnId')
                 AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'本角色内该字段的位置(1..n;只对勾选=显示的字段有值,隐藏为 NULL)。覆盖表里没有该字段的行=未定制,按系统整体顺序排在已编号字段之后',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_field_view', N'COLUMN', N'seq';
GO

/* 表级注明同步成"含序号"的口径 */
EXEC sp_updateextendedproperty N'MS_Description',
     N'角色字段视图(2026-11-13):同一面板在不同角色下"显示/隐藏哪些字段、按什么顺序"。行存在=该角色显式设定,行不存在=跟随系统整体(yj_field);只存显隐与角色内序号,栏名仍走系统整体',
     N'SCHEMA', N'dbo', N'TABLE', N'yj_field_view';
GO

/* 自检 */
DECLARE @ncol int, @has int;
SELECT @ncol = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.yj_field_view');
SELECT @has = COUNT(*) FROM sys.extended_properties
   WHERE major_id = OBJECT_ID(N'dbo.yj_field_view')
     AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_field_view'), N'seq', 'ColumnId')
     AND name = N'MS_Description';

IF @ncol <> 9 RAISERROR(N'自检失败:yj_field_view 列数应为 9,实际 %d', 16, 1, @ncol);
IF @has <> 1 RAISERROR(N'自检失败:yj_field_view.seq 缺列级中文注明', 16, 1);

/* 取证:yj_field 依旧未触碰 */
DECLARE @fn bigint, @fck int;
SELECT @fn = COUNT(*), @fck = CHECKSUM_AGG(BINARY_CHECKSUM(panel_code, place, seq, col_name, label,
                                                          alias, hidden, visible, editable, required))
  FROM yj_field;
PRINT N'[取证] yj_field 未触碰: 行数=' + CAST(@fn AS nvarchar(20))
    + N' 校验和=' + ISNULL(CAST(@fck AS nvarchar(20)), N'NULL');
PRINT N'[完成] yj_field_view 列 ' + CAST(@ncol AS nvarchar(10)) + N' / seq 注明 1';
GO
