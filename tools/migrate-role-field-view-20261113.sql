/* ============================================================================
   migrate-role-field-view-20261113.sql —— 角色字段视图(yj_field_view)
   ----------------------------------------------------------------------------
   用户口径(2026-11-13 拍板,不可自行扩展):
     ① **两层**:系统整体 → 角色。同一角色内所有账号看到的一样,**不细分到个人账号**。
     ② **原「表格调整 / 表头调整」功能保持不变**:它俩照旧写 yj_field(即"系统整体")。
        角色定制 = 在整体之上再盖一层"显示 / 隐藏"。
     ③ 本表**只存显隐**;字段顺序与栏名仍由整体(表格调整/表头调整)决定 ——
        刻意不做按角色的排序/改名:顺序天生是"整组定序",按角色存会引出新字段落位、
        同名头行字段错配等一串坑,而用户本次要的只是"各角色看到不同字段"。
     ④ **不碰 yj_field 一个字节**:本脚本只做「建表 + 中文注明 + 自检」。
        新表初始为空 ⇒ 上线那一刻所有角色看到的就是现在的样子(零回退、零行为变化)。
        脚本末尾会把 yj_field 的行数与校验和打印进执行日志,便于部署台账取证。

   三态语义:行存在 = 该角色显式设定;行不存在 = 跟随系统整体。
   ============================================================================ */
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;

/* ---------- 1. 建表(幂等) ---------- */
IF OBJECT_ID(N'dbo.yj_field_view', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.yj_field_view (
        id          int           IDENTITY(1,1) NOT NULL,
        panel_code  varchar(40)   NOT NULL,   -- 面板编码(与 yj_panel.panel_code 同值)
        place_kind  varchar(10)   NOT NULL,   -- 字段位置:header(表头)| detail(明细/表格列)
        col_name    sysname       NOT NULL,   -- 物理列名(与 yj_field.col_name 同源)
        role_code   nvarchar(80)  NOT NULL,   -- 角色编码(与 yj_role.role_code 同值)
        shown       bit           NOT NULL,   -- 1=该角色显示 0=该角色隐藏
        operator    nvarchar(80)  NULL,       -- 最后修改人(登录名)
        updated_at  datetime2(0)  NOT NULL CONSTRAINT df_yj_field_view_updated DEFAULT (SYSDATETIME()),
        CONSTRAINT pk_yj_field_view PRIMARY KEY CLUSTERED (id),
        CONSTRAINT ux_yj_field_view UNIQUE (panel_code, place_kind, col_name, role_code),
        CONSTRAINT ck_yj_field_view_place CHECK (place_kind IN ('header', 'detail'))
    );
    PRINT N'[创建] dbo.yj_field_view';
END
ELSE
    PRINT N'[跳过] dbo.yj_field_view 已存在';
GO

/* ---------- 2. 索引(幂等):按角色取整面板的覆盖行 ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_yj_field_view_role'
                                          AND object_id = OBJECT_ID(N'dbo.yj_field_view'))
    CREATE INDEX ix_yj_field_view_role ON dbo.yj_field_view (role_code, panel_code);
GO

/* ---------- 3. 中文注明(幂等:缺才补,已有不覆盖) ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.yj_field_view') AND ep.minor_id = 0 AND ep.name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'角色字段视图(2026-11-13):同一面板在不同角色下"显示/隐藏哪些字段"。行存在=该角色显式设定,行不存在=跟随系统整体(yj_field);只存显隐,顺序与栏名仍由表格调整/表头调整(整体)决定',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_field_view';
GO

/* ---------- 4. 列级中文注明(规范 §03:英文列名必须注明) ---------- */
DECLARE @tbl int = OBJECT_ID(N'dbo.yj_field_view');
DECLARE @cols TABLE (col sysname PRIMARY KEY, descr nvarchar(400));
INSERT INTO @cols (col, descr) VALUES
 (N'id',         N'主键(自增)'),
 (N'panel_code', N'面板编码(与 yj_panel.panel_code 同值)'),
 (N'place_kind', N'字段位置:header=表头 / detail=明细表格列'),
 (N'col_name',   N'物理列名(与 yj_field.col_name 同源;同名列分处表头与明细时靠 place_kind 区分)'),
 (N'role_code',  N'角色编码(与 yj_role.role_code 同值;同一角色所有账号共用一套)'),
 (N'shown',      N'该角色是否显示该字段:1=显示 0=隐藏(行不存在=跟随系统整体)'),
 (N'operator',   N'最后修改人(登录名,留痕用)'),
 (N'updated_at', N'最后修改时间');

DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = @tbl AND ep.minor_id = COLUMNPROPERTY(@tbl, @c, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @d,
             N'SCHEMA', N'dbo', N'TABLE', N'yj_field_view', N'COLUMN', @c;
    FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- 5. 自检(不过即报错,便于 DbSync 判定失败) ---------- */
DECLARE @ncol int, @cmt int, @tcmt int;
SELECT @ncol = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.yj_field_view');
SELECT @tcmt = COUNT(*) FROM sys.extended_properties
   WHERE major_id = OBJECT_ID(N'dbo.yj_field_view') AND minor_id = 0 AND name = N'MS_Description';
SELECT @cmt = COUNT(*) FROM sys.columns c
   WHERE c.object_id = OBJECT_ID(N'dbo.yj_field_view') AND c.name <> N'id'
     AND EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description');

IF @ncol <> 8      RAISERROR(N'自检失败:yj_field_view 列数应为 8,实际 %d', 16, 1, @ncol);
IF @tcmt <> 1      RAISERROR(N'自检失败:yj_field_view 缺表级中文注明', 16, 1);
IF @cmt <> 7       RAISERROR(N'自检失败:yj_field_view 列级中文注明应 7 条(除 id),实际 %d', 16, 1, @cmt);

/* ---------- 6. 取证:yj_field 未被本脚本触碰(部署台账要抄这一行) ---------- */
DECLARE @fn bigint, @fck int;
SELECT @fn = COUNT(*), @fck = CHECKSUM_AGG(BINARY_CHECKSUM(panel_code, place, seq, col_name, label,
                                                          alias, hidden, visible, editable, required))
  FROM yj_field;
PRINT N'[取证] yj_field 未触碰: 行数=' + CAST(@fn AS nvarchar(20))
    + N' 校验和=' + ISNULL(CAST(@fck AS nvarchar(20)), N'NULL') + N'(与迁移前对照一致即为"零回退")';
PRINT N'[完成] 角色字段视图就绪: yj_field_view 列 ' + CAST(@ncol AS nvarchar(10)) + N' / 表注明 1 / 列注明 7';
GO
