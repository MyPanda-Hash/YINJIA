/* _probe-plangpc-scjl-link.sql — 只读：三表关联键的**实测体检**(悬空/孤儿/口径差) */
SET NOCOUNT ON;

SELECT '== plang 规模 ==' AS section,
       'count=' + CAST(COUNT(*) AS varchar(10)) + ' min_id=' + CAST(MIN(id) AS varchar(10)) + ' max_id=' + CAST(MAX(id) AS varchar(10)) AS x
FROM dbo.plang;

SELECT '== plang_pc 全部行(2 行) ==' AS section;
SELECT CAST(pc.id AS varchar(10)) + ' | plang_id=' + CAST(ISNULL(pc.plang_id,-1) AS varchar(10))
       + ' | pl_no=' + ISNULL(pc.pl_no,'-') + ' | pl_xc=' + CAST(ISNULL(pc.pl_xc,0) AS varchar(10))
       + ' | scx=' + ISNULL(pc.scx,'-') + ' | pl_sl=' + CAST(ISNULL(pc.pl_sl,0) AS varchar(20))
       + ' | 批次号=' + ISNULL(pc.批次号,'-') + ' | pl_date=' + ISNULL(CONVERT(varchar(19),pc.pl_date,120),'-')
       + ' | 关联工单行存在? ' + CASE WHEN EXISTS(SELECT 1 FROM dbo.plang p WHERE p.id = pc.plang_id) THEN 'Y' ELSE 'N(悬空!)' END AS row
FROM dbo.plang_pc pc ORDER BY pc.id DESC;

SELECT '== plang_pc.plang_id 悬空清单 ==' AS section;
SELECT CAST(pc.id AS varchar(10)) + ' | plang_id=' + CAST(ISNULL(pc.plang_id,-1) AS varchar(10)) + ' | ' + ISNULL(pc.pl_no,'-') AS row
FROM dbo.plang_pc pc WHERE NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.id = pc.plang_id);

SELECT '== plang_pc 按 comm+pl_no+pl_xc 能否命中 plang(冗余键口径) ==' AS section;
SELECT CAST(pc.id AS varchar(10)) + ' | ' + ISNULL(pc.pl_no,'-') + ' | xc=' + CAST(ISNULL(pc.pl_xc,0) AS varchar(10))
       + ' | 命中行数=' + CAST((SELECT COUNT(*) FROM dbo.plang p WHERE p.comm=pc.comm AND p.pl_no=pc.pl_no AND ISNULL(p.pl_xc,0)=ISNULL(pc.pl_xc,0)) AS varchar(10))
       + ' | 命中 plang.id=' + ISNULL((SELECT TOP 1 CAST(p.id AS varchar(10)) FROM dbo.plang p WHERE p.comm=pc.comm AND p.pl_no=pc.pl_no AND ISNULL(p.pl_xc,0)=ISNULL(pc.pl_xc,0) ORDER BY p.id),'-') AS row
FROM dbo.plang_pc pc ORDER BY pc.id DESC;

SELECT '== GD-2026-10-0007 在 plang 里的行 ==' AS section;
SELECT CAST(id AS varchar(10)) + ' | ' + ISNULL(pl_no,'-') + ' | xc=' + CAST(ISNULL(pl_xc,0) AS varchar(10))
       + ' | 批次号=' + ISNULL(批次号,'-') + ' | scx=' + ISNULL(scx,'-') + ' | pl_sl=' + CAST(ISNULL(pl_sl,0) AS varchar(20))
       + ' | asp_cancel=' + ISNULL(asp_cancel,'-') + ' | 工艺路线=' + ISNULL(工艺路线,'-') AS row
FROM dbo.plang WHERE pl_no = 'GD-2026-10-0007' ORDER BY id;

SELECT '== scjl 全部行(4 行) ==' AS section;
SELECT CAST(s.id AS varchar(10)) + ' | 报工单号=' + ISNULL(s.报工单号,'-') + ' | gldh=' + ISNULL(s.gldh,'-')
       + ' | gd_id=' + CAST(ISNULL(s.gd_id,-1) AS varchar(10)) + ' | 工单行号=' + CAST(ISNULL(s.工单行号,-1) AS varchar(10))
       + ' | gxdm=' + ISNULL(s.gxdm,'-') + ' | sl=' + CAST(ISNULL(s.sl,0) AS varchar(20)) + ' | wgzt=' + ISNULL(s.wgzt,'-')
       + ' | 批次号=' + ISNULL(s.批次号,'-') + ' | scx=' + ISNULL(s.scx,'-') + ' | delmark=' + CAST(ISNULL(s.delmark,-1) AS varchar(5))
       + ' | gd_id 命中 plang_pc? ' + CASE WHEN EXISTS(SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id) THEN 'Y' ELSE 'N(孤儿)' END AS row
FROM dbo.scjl s ORDER BY s.id DESC;

SELECT '== scjl.gldh 在 plang 里的命中(整单口径) ==' AS section;
SELECT ISNULL(s.gldh,'(空)') AS gldh,
       'plang 行数=' + CAST((SELECT COUNT(*) FROM dbo.plang p WHERE p.pl_no = s.gldh) AS varchar(10)) AS hit
FROM (SELECT DISTINCT gldh FROM dbo.scjl) s;

SELECT '== scjl 与 plang_pc 同名字段值是否一致(按 gd_id=pc.id) ==' AS section;
SELECT CAST(s.id AS varchar(10)) + ' | 批次号 s=' + ISNULL(s.批次号,'-') + ' pc=' + ISNULL(pc.批次号,'-')
       + ' | scx s=' + ISNULL(s.scx,'-') + ' pc=' + ISNULL(pc.scx,'-')
       + ' | pl_sl s=' + CAST(ISNULL(s.pl_sl,0) AS varchar(20)) + ' pc=' + CAST(ISNULL(pc.pl_sl,0) AS varchar(20))
       + ' | 工单行号 s=' + CAST(ISNULL(s.工单行号,-1) AS varchar(10)) + ' pc.pl_xc=' + CAST(ISNULL(pc.pl_xc,0) AS varchar(10)) AS row
FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id ORDER BY s.id DESC;
