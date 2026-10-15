/* migrate-doc-annotation-20261016.sql
 * 新建 yj_doc_annotation —— 单据纸面**文字标注**(标注笔/橡皮擦)的存储。
 *
 * 【用户口径 2026-10-16】
 *   「给所有的研发管理的面板都在侧边栏的文档输出下加上一个标注笔的功能,就是点击之后可以选择
 *     填写的内容然后进行一个标色加粗,颜色使用色盘,标注之后的字体可以打印出对应的颜色,
 *     标注笔下再加一个橡皮擦,可以擦掉标注过的字的标注效果」。
 *
 * 【为什么是"范围"而不是"整字段"】用户口径是「标注过的**字**」⇒ 粒度到字符区间。
 *   渲染侧只影响**只读态纸面 + 打印**(可编辑态的值在 <input> 里,HTML 无法只给其中几个字上色)。
 *
 * 【坐标口径(全链路统一,前端 docAnnotation.js 同口径)】
 *   start_pos/end_pos = 相对该字段**完整原文**的字符下标,0 基,**左闭右开 [start,end)**;
 *   同一字段多段可共存;重叠段由后端归一(后写入覆盖先写入)后落库。
 *   field_key 存的是 **yj_field.label**(前端行模型是 { [label]: value },配置与接口一律用 label)。
 *
 * 【为什么不塞进业务表的某个列】① 一段标注存不下(多区间);② 业务表列是金蝶同步/其它模块的
 *   读写面,塞标记会污染导出与同步口径;③ 标注是"显示层批注",与单据事实数据分表更干净。
 *
 * 【幂等】建表/索引/注明各自判空;末尾自检表与关键列齐备,否则 RAISERROR。
 * 【执行】两账套各跑一遍(先 HSDZ_MES 后 HSDZ_MES_TEST),跑到「执行 0、失败 0」。
 *   同时已登记 tools/db-inuse-tables.txt,并重生成 docs/development/数据库表清单.md。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.yj_doc_annotation', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.yj_doc_annotation (
    id         int IDENTITY(1,1) NOT NULL,
    panel_code varchar(40)   NOT NULL,
    doc_no     nvarchar(120) NOT NULL,
    field_key  nvarchar(120) NOT NULL,
    start_pos  int           NOT NULL,
    end_pos    int           NOT NULL,
    color      nvarchar(20)  NOT NULL,
    bold       bit           NOT NULL CONSTRAINT DF_yj_doc_annotation_bold   DEFAULT (0),
    asp_user1  nvarchar(100) NULL,
    asp_time1  datetime2     NULL     CONSTRAINT DF_yj_doc_annotation_time1  DEFAULT (GETDATE()),
    asp_user2  nvarchar(100) NULL,
    asp_time2  datetime2     NULL,
    asp_cancel char(1)       NOT NULL CONSTRAINT DF_yj_doc_annotation_cancel DEFAULT ('N'),
    CONSTRAINT PK_yj_doc_annotation PRIMARY KEY CLUSTERED (id),
    CONSTRAINT CK_yj_doc_annotation_range CHECK (end_pos > start_pos)
  );
  PRINT N'   [建表] yj_doc_annotation';
END
ELSE PRINT N'   [跳过] yj_doc_annotation 已存在';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.yj_doc_annotation') AND name = N'IX_yj_doc_annotation_doc')
BEGIN
  CREATE INDEX IX_yj_doc_annotation_doc ON dbo.yj_doc_annotation (panel_code, doc_no);
  PRINT N'   [建索引] IX_yj_doc_annotation_doc (panel_code, doc_no)';
END
ELSE PRINT N'   [跳过] 索引已存在';
GO

-- 中文注明(AGENTS 红线:新表必须带)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.yj_doc_annotation') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'单据纸面文字标注(标注笔/橡皮擦):一条=一个字符区间',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_annotation';

DECLARE @cols TABLE (c sysname, d nvarchar(400));
INSERT INTO @cols (c, d) VALUES
  (N'panel_code', N'面板码(如 RD_PROD_INFO)'),
  (N'doc_no',     N'单据编号'),
  (N'field_key',  N'字段数据键 = yj_field.label(前端行模型 {[label]:value} 的键)'),
  (N'start_pos',  N'起始字符下标(0 基,相对该字段完整原文)'),
  (N'end_pos',    N'结束字符下标(左闭右开 [start,end))'),
  (N'color',      N'文字颜色 #RRGGBB(取自前端 8 档色盘)'),
  (N'bold',       N'是否加粗(1=加粗)'),
  (N'asp_user1',  N'标注人账号'),
  (N'asp_time1',  N'标注时间'),
  (N'asp_user2',  N'擦除人账号'),
  (N'asp_time2',  N'擦除时间'),
  (N'asp_cancel', N'作废标记(N=有效)');
DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT c, d FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.yj_doc_annotation', @c) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                      WHERE major_id = OBJECT_ID(N'dbo.yj_doc_annotation')
                        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_doc_annotation'), @c, 'ColumnId')
                        AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @d,
         N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_annotation', N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

PRINT N'== 自检 ==';
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.yj_doc_annotation', N'U') IS NULL
BEGIN PRINT N'   [X] 表不存在'; SET @bad = @bad + 1; END
DECLARE @miss nvarchar(400) = N'';
SELECT @miss = @miss + c + N' '
FROM (VALUES (N'id'),(N'panel_code'),(N'doc_no'),(N'field_key'),(N'start_pos'),(N'end_pos'),(N'color'),(N'bold'),
             (N'asp_user1'),(N'asp_time1'),(N'asp_user2'),(N'asp_time2'),(N'asp_cancel')) v(c)
WHERE COL_LENGTH(N'dbo.yj_doc_annotation', c) IS NULL;
IF @miss <> N''
BEGIN PRINT N'   [X] 缺列: ' + @miss; SET @bad = @bad + 1; END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.yj_doc_annotation') AND name = N'IX_yj_doc_annotation_doc')
BEGIN PRINT N'   [X] 缺索引 IX_yj_doc_annotation_doc'; SET @bad = @bad + 1; END
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.yj_doc_annotation') AND minor_id = 0 AND name = N'MS_Description') = 0
BEGIN PRINT N'   [X] 缺表级中文注明'; SET @bad = @bad + 1; END
IF @bad > 0 RAISERROR(N'[自检] yj_doc_annotation 不完整', 16, 1);
ELSE PRINT N'   [OK] yj_doc_annotation 就位(表 + 13 列 + 索引 + 表/列中文注明)';
GO
