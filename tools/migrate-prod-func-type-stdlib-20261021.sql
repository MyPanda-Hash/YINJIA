/* =============================================================================
   migrate-prod-func-type-stdlib-20261021.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-21):「产品信息表的功能类别下拉做成一个标准库,可以进行填写维护」。

   现状(实测):RD_PROD_INFO.产品功能类别 是下拉框,字典写死在 yj_field.dict_sql 里:
     SELECT v FROM (VALUES (N'除余氯'),(N'VOC'),(N'重金属')) AS t(v)
   ⇒ 只有 3 个固定选项,加一个要改迁移脚本,用户自己维护不了。

   改法:**不新建表、不新建面板**,复用已有的「数据字典」面板(ZDGL,底表 bs_dict)。
     · 字典类别 = '产品功能类别'(与字段中文名同名,便于对照)
     · 维护入口 = 系统管理平台 → 数据建模 → 数据字典(现成面板,用户已会用)
     · 字典值 = bs_dict.名称;排序 = bs_dict.排序;停用 = 状态<>'启用' 或 asp_cancel='Y'
   幂等:seed 用 NOT EXISTS 判重;UPDATE dict_sql 无条件覆盖(同一句,重复执行结果一致)。
   ============================================================================= */

SET NOCOUNT ON;
GO

/* ---------- 1. 把现有 3 个写死的选项搬进数据字典 ---------- */
INSERT INTO dbo.bs_dict (字典类别, 代码, 名称, 状态, 排序, 备注, asp_user1, asp_time1, asp_cancel)
SELECT N'产品功能类别', v.code, v.name, N'启用', v.seq, N'产品信息表·功能类别(2026-10-21 由写死下拉改为标准库)',
       N'migration', SYSDATETIME(), 'N'
FROM (VALUES
        (N'除余氯',  N'除余氯',  10),
        (N'VOC',    N'VOC',     20),
        (N'重金属',  N'重金属',  30)
     ) AS v(code, name, seq)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.bs_dict d
    WHERE d.字典类别 = N'产品功能类别' AND d.名称 = v.name AND ISNULL(d.asp_cancel,'N') <> 'Y'
);
GO

/* ---------- 2. 字段字典改读标准库 ---------- */
UPDATE dbo.yj_field
   SET dict_sql = N'SELECT 名称 AS v FROM bs_dict WHERE 字典类别 = N''产品功能类别'' AND ISNULL(asp_cancel, ''N'') <> ''Y'' AND ISNULL(状态, N''启用'') = N''启用'' ORDER BY ISNULL(排序, 9999), id'
 WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品功能类别';
GO

/* ---------- 3. 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dict WHERE 字典类别 = N'产品功能类别' AND ISNULL(asp_cancel,'N') <> 'Y')
    RAISERROR(N'产品功能类别 标准库一条都没写进去', 16, 1);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field
               WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品功能类别' AND dict_sql LIKE N'%bs_dict%')
    RAISERROR(N'RD_PROD_INFO.产品功能类别 的 dict_sql 没有指向 bs_dict', 16, 1);
GO
