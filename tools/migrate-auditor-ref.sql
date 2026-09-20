-- migrate-auditor-ref.sql — 「审核人」字段绑定职员档案(EMP)
-- 2026-09-20 用户口径:查询弹窗里的「审核人」要能点选职员(第 3 条)。
--   范围:所有面板 **表头位** 的「审核人」字段(表头的才会出现在「查询」弹窗/表单里);
--   明细位/报表明细列不动(那些是报表正文列,不参与查询条件)。
--   口径:审核人存的是姓名(如 王光珍/冯加劲)→ ref_panel=EMP, ref_field=员工名称, display_field=员工名称;
--   与「业务员/经手人/检验员」同一口径。
--
-- 配套后端改动(QueryService.appendDocFilters):「审核人」是虚拟字段 —— 显示值取自 yj_doc_status.shr,
--   表内同名列对 MES 单据为空(只有金蝶同步单写列)。过滤已改为「表内列 LIKE ? OR yj_doc_status.shr LIKE ?」并集,
--   否则在弹窗里选了审核人永远筛不出 MES 单据(见同批次提交的 QueryService 注释)。
--
-- 数据现状提示(2026-09-20 实测 yj_doc_status.shr 分布):
--   王光珍 3744 / 冯加劲 2145 / 测试导入 101 / 廖小姐 35 / admin 10 / 孙淼淼 10 / 叶健乐 3 / 管理员 1 / 蒋小刚 1;
--   其中 王光珍·冯加劲·孙淼淼·叶健乐·蒋小刚 在 bs_emp 里(可选),admin/管理员/测试导入/廖小姐 不在职员档案
--   → MES 侧以 admin 审批的单据暂时挑不到(需给账号建职员档案,或审批改用真实姓名账号)。
-- 幂等可重跑。
SET NOCOUNT ON;
GO

UPDATE yj_field SET data_type = N'参照', ref_panel = 'EMP', ref_field = N'员工名称', display_field = N'员工名称'
WHERE label = N'审核人' AND place LIKE '%header%'
  AND (ISNULL(ref_panel, '') <> 'EMP' OR data_type <> N'参照');
GO

-- 自检:表头位「审核人」应全部为参照 EMP
SELECT COUNT(*) AS 表头审核人总数,
       SUM(CASE WHEN data_type = N'参照' AND ref_panel = 'EMP' THEN 1 ELSE 0 END) AS 已绑职员档案数
FROM yj_field WHERE label = N'审核人' AND place LIKE '%header%';
GO

-- 断言:仍非「参照 EMP」的表头审核人行数必须为 0
SELECT COUNT(*) AS 未绑定行数 FROM yj_field
WHERE label = N'审核人' AND place LIKE '%header%'
  AND NOT (data_type = N'参照' AND ref_panel = 'EMP' AND ref_field = N'员工名称');
GO
PRINT N'migrate-auditor-ref 完成';
GO
