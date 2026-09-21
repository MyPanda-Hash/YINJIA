/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-change-dept-map.sql — 产品变更申请单「部门行 ↔ 系统部门(账号)」映射表(2026-09-21)

   为什么需要这张表:YJ-QR-130《KPC变更申请通知单》的「部门评审意见」是**纸面 7 个部门**
   (开发部 / 成型工艺科 / 组装车间 / 销售部 / 品质部 / 计划组 / 仓管部),而系统里的
   yj_dept 是人事口径的实际部门(产品开发部 / 开发科 / 工艺科 / 生产部 / 销售中心 /
   质量管理部 / 检测科 / 生产管理中心 / 仓管部 …)。两套口径不是一对一,纸面部门名
   在 yj_dept 里根本不存在 —— 因此「各部门按账号填本部门栏目」的门禁必须有一层映射:
   账号 yj_user.dept_id → 本表 dept_id → 本表「部门」= 该账号可填写的纸面部门行。

   口径(已敲定,2026-09-21):
     ① 部门行 = 本表「部门」去重(按 sort)= 纸面 7 预置行,建单时自动铺进 rd_change_detail;
     ② 一个纸面部门可对应多个系统部门(如 品质部 ← 质量管理部 + 检测科):任一所辖部门的账号都能填该行;
     ③ 未在本表登记的账号(含 dept_id 为空)不能填任何部门行;管理员豁免(可代填);
     ④ 要加/改部门行 = 往本表插/改行(无需改代码);删掉某纸面部门的全部行即不再铺该行。

   幂等:建表 IF OBJECT_ID IS NULL;注释/映射行 NOT EXISTS;用法同其它迁移(见 tools/README.md)。
   ═══════════════════════════════════════════════════════════════════════════════ */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. 建表 yj_change_dept(纸面部门 ↔ 系统部门)
-- ═══════════════════════════════════════════════════════════════════
IF OBJECT_ID('yj_change_dept') IS NULL
BEGIN
  CREATE TABLE yj_change_dept (
    id          int IDENTITY(1,1) PRIMARY KEY,
    部门        nvarchar(60) NOT NULL,   -- 纸面部门行名(YJ-QR-130 部门评审意见栏)
    dept_id     int          NOT NULL,   -- 系统部门 yj_dept.id(账号 yj_user.dept_id 命中即可填该行)
    sort        int          NULL,       -- 部门行在单上的先后(纸面顺序)
    asp_user1   nvarchar(100) NULL,
    asp_time1   datetime2     NULL,
    asp_user2   nvarchar(100) NULL,
    asp_time2   datetime2     NULL
  );
  CREATE UNIQUE INDEX ux_yj_change_dept ON yj_change_dept (部门, dept_id);
  PRINT N'已建表 yj_change_dept';
END
ELSE PRINT N'yj_change_dept 已存在,跳过';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. 表/列中文注释(MS_Description;已有不覆盖)
-- ═══════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('yj_change_dept') AND minor_id=0 AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'产品变更申请单部门映射:纸面「部门评审意见」的部门行(YJ-QR-130 的 7 个部门)↔ 系统部门 yj_dept.id —— 账号按 yj_user.dept_id 命中本表即可填写对应部门行(管理员豁免)',
       N'SCHEMA',N'dbo',N'TABLE',N'yj_change_dept';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('yj_change_dept') AND minor_id=COLUMNPROPERTY(OBJECT_ID('yj_change_dept'),N'部门','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'纸面部门行名(如 开发部;同一纸面部门可对应多个系统部门)',
       N'SCHEMA',N'dbo',N'TABLE',N'yj_change_dept',N'COLUMN',N'部门';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('yj_change_dept') AND minor_id=COLUMNPROPERTY(OBJECT_ID('yj_change_dept'),N'dept_id','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'系统部门 yj_dept.id(账号 yj_user.dept_id 与之相等即可填该纸面部门行)',
       N'SCHEMA',N'dbo',N'TABLE',N'yj_change_dept',N'COLUMN',N'dept_id';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('yj_change_dept') AND minor_id=COLUMNPROPERTY(OBJECT_ID('yj_change_dept'),N'sort','ColumnId') AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'部门行在单上的先后(纸面顺序:开发部10/成型工艺科20/组装车间30/销售部40/品质部50/计划组60/仓管部70)',
       N'SCHEMA',N'dbo',N'TABLE',N'yj_change_dept',N'COLUMN',N'sort';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. 预置映射(按现有 yj_dept 口径落位;公司组织调整时改本表即可,无需改代码)
--    未登记系统部门的纸面部门(如暂无「组装车间」账号)仍会铺行,由管理员代填/后续建号。
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_change_dept (部门, dept_id, sort)
SELECT v.部门, d.id AS dept_id, v.sort
FROM (VALUES
  (N'开发部',     N'产品开发部',   10),
  (N'开发部',     N'开发科',       10),
  (N'开发部',     N'材料研发部',   10),
  (N'成型工艺科', N'工艺科',       20),
  (N'组装车间',   N'生产部',       30),
  (N'销售部',     N'销售中心',     40),
  (N'销售部',     N'市场营销',     40),
  (N'销售部',     N'业务跟单',     40),
  (N'品质部',     N'质量管理部',   50),
  (N'品质部',     N'检测科',       50),
  (N'计划组',     N'生产管理中心', 60),
  (N'仓管部',     N'仓管部',       70)
) AS v(部门, dept_name, sort)
JOIN yj_dept d ON d.dept_name = v.dept_name
WHERE NOT EXISTS (SELECT 1 FROM yj_change_dept x WHERE x.部门 = v.部门 AND x.dept_id = d.id);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. 校验输出
-- ═══════════════════════════════════════════════════════════════════
-- ⚠ 库兼容级别 100:不能用 STRING_AGG(需 110+),逐行列出
SELECT c.部门, c.sort, COUNT(c.dept_id) AS 系统部门数,
       ISNULL(STUFF((SELECT N'、' + d2.dept_name FROM yj_change_dept c2
                       JOIN yj_dept d2 ON d2.id = c2.dept_id
                      WHERE c2.部门 = c.部门 ORDER BY d2.dept_name FOR XML PATH('')), 1, 1, N''), N'') AS 系统部门
  FROM yj_change_dept c GROUP BY c.部门, c.sort ORDER BY c.sort;
GO
SELECT N'yj_change_dept 行数' AS 检查项, CAST(COUNT(*) AS nvarchar) AS 值 FROM yj_change_dept
UNION ALL SELECT N'纸面部门行数(应 7)', CAST(COUNT(DISTINCT 部门) AS nvarchar) FROM yj_change_dept
UNION ALL SELECT N'cp/glm53 可填行数(应 1:开发部)', CAST(COUNT(DISTINCT c.部门) AS nvarchar)
       FROM yj_change_dept c JOIN yj_user u ON u.dept_id = c.dept_id WHERE u.username IN (N'cp', N'glm53')
UNION ALL SELECT N'表注释', CAST(COUNT(*) AS nvarchar) FROM sys.extended_properties
       WHERE major_id = OBJECT_ID('yj_change_dept') AND name = 'MS_Description';
GO
