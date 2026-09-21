/* ═══════════════════════════════════════════════════════════════════════════════
   seed-demo-prodfile.sql — 「产品文件」演示数据(2026-09-21)

   用途:部署到服务器后让工作人员**一登录就有单可跑** —— 不用先手工建 2 个产品 × 4 个受控文件
        再逐张走审批。灌完的库状态:
          · 两个演示产品(产品编号 DEMO-A-001 / DEMO-B-001)的**产品信息表已归档**(两级审核留痕齐全)
          · 每个产品的**四个受控文件已归档**(成型工艺清单/组装工艺清单/规格书/出货检验计划表)
            并已**分发责任人**(成型+规格书→cp,组装+出货检验→glm53)
          · 产品 A 上挂一张**草稿态的产品变更申请单**(勾了成型工艺清单+规格书、需会签=是、
            会签人 glm53+demo_pinzhi、7 个部门评审行已有 1 行示例内容)——
            工作人员可以直接从"各部门填本部门栏 → 提交会签 → 会签 → 冯总审批 → 生效"往下走
          · 六个**部门演示账号**(工艺科/生产部/销售中心/质量管理部/生产管理中心/仓管部),
            用来演示"每人只能改自己那一行"的门禁

   幂等:先按 DEMO- 前缀删掉上一次灌的数据,再插;可反复执行。
   命名:所有演示单据号以 DEMO- 开头(工具不会生成这种号,不会与新单撞号);
        tools/migrate-testdata-cleanup.sql 的清理规则**显式跳过 DEMO-** 的数据。
   口令:演示账号与现有演示账号同口令(取自 cp 的密码哈希 —— 即 123456),首次登录请自行修改。
   用法:java -cp tools/lib/mssql-jdbc.jar tools/SqlRunner.java "<jdbcUrl>" yinjia env tools/seed-demo-prodfile.sql
   ═══════════════════════════════════════════════════════════════════════════════ */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════ 0. 幂等:清掉上一次的演示数据 ═══════════════
DECLARE @demo TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @demo (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%';
INSERT INTO @demo (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%';
INSERT INTO @demo (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%';
INSERT INTO @demo (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%';
INSERT INTO @demo (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%';
INSERT INTO @demo (no) SELECT 单据编号 FROM rd_change_head    WHERE 产品编号 LIKE N'DEMO-%';
DELETE FROM yj_message       WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM yj_form_approval WHERE form_no   IN (SELECT no FROM @demo);
DELETE FROM yj_doc_status    WHERE doc_no    IN (SELECT no FROM @demo);
DELETE FROM rd_change_detail     WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_mold_proc_detail  WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_asm_proc_detail   WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_spec_doc_detail   WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_insp_plan_detail  WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_change_head    WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_prod_info_head WHERE 单据编号 IN (SELECT no FROM @demo);
DELETE FROM rd_dev_task WHERE 产品编号 LIKE N'DEMO-%';
GO

-- ═══════════════ 1. 六个部门演示账号(口令同现有演示账号:123456) ═══════════════
DECLARE @hash nvarchar(400) = (SELECT TOP 1 password_hash FROM yj_user WHERE username = N'cp');
INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)
SELECT v.username, @hash, v.real_name, 'N', d.id, 2, '1'
FROM (VALUES
  (N'demo_gongyi',    N'演示-工艺科',   N'工艺科'),
  (N'demo_shengchan', N'演示-生产部',   N'生产部'),
  (N'demo_xiaoshou',  N'演示-销售中心', N'销售中心'),
  (N'demo_pinzhi',    N'演示-质量管理部', N'质量管理部'),
  (N'demo_jihua',     N'演示-生产管理中心', N'生产管理中心'),
  (N'demo_cangku',    N'演示-仓管部',   N'仓管部')
) AS v(username, real_name, dept_name)
JOIN yj_dept d ON d.dept_name = v.dept_name
WHERE NOT EXISTS (SELECT 1 FROM yj_user u WHERE u.username = v.username);
GO

-- ═══════════════ 2. 两个演示产品:产品信息表(已归档) ═══════════════
-- ⚠ 直接 INSERT 必须用**物理列名**:面板上的「产品负责人」只是 yj_field 标签,列名是 责任人
--    (踩过:写 产品负责人 报"列名无效",而报错信息指名的是另一个列,容易看错方向)
DECLARE @today nvarchar(40) = CONVERT(nvarchar(10), GETDATE(), 120);
INSERT INTO rd_prod_info_head (单据编号, 单据日期, 产品编号, 产品名称, 产品类别, 客户项目名称, 责任人,
                               产品形态, 产品功能类别, 产品管控等级, 审核人一级, 审核人二级, 备注, asp_user1, asp_time1)
VALUES
 (N'DEMO-PI-001', @today, N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'滤芯', N'演示客户项目-A', N'陈秀丽',
  N'成品', N'除重金属', N'二级', N'系统管理员', N'彭于晏', N'演示数据:可直接用于变更流程测试', N'cp', GETDATE()),
 (N'DEMO-PI-002', @today, N'DEMO-B-001', N'碱性炭棒滤芯(演示)', N'滤芯', N'演示客户项目-B', N'陈秀丽',
  N'成品', N'碱性', N'三级', N'系统管理员', N'彭于晏', N'演示数据:第二个产品(用于对比/多产品场景)', N'cp', GETDATE());
GO
-- 状态行:已归档 + 两级审核留痕(「审批情况」弹窗里看得到完整历史)
INSERT INTO yj_doc_status (panel_code, doc_no, saved, archived, pending, shr, shsj)
SELECT N'RD_PROD_INFO', 单据编号, 'Y', 'Y', 'N', N'admin', GETDATE()
  FROM rd_prod_info_head WHERE 单据编号 IN (N'DEMO-PI-001', N'DEMO-PI-002');
GO
INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)
SELECT N'RD_PROD_INFO', v.no, v.action, v.result, v.node, v.op, v.opinion, DATEADD(minute, v.mi, GETDATE())
FROM (VALUES
  (N'DEMO-PI-001', N'SUBMIT',     N'PENDING',   1, N'cp',    N'',                      -60),
  (N'DEMO-PI-001', N'APPROVE_L1', N'L1_PASSED', 1, N'admin', N'资料齐全，转二级审核',   -40),
  (N'DEMO-PI-001', N'APPROVE',    N'APPROVED',  2, N'glm53', N'同意归档',               -20),
  (N'DEMO-PI-002', N'SUBMIT',     N'PENDING',   1, N'cp',    N'',                      -55),
  (N'DEMO-PI-002', N'APPROVE_L1', N'L1_PASSED', 1, N'admin', N'资料齐全，转二级审核',   -35),
  (N'DEMO-PI-002', N'APPROVE',    N'APPROVED',  2, N'glm53', N'同意归档',               -15)
) AS v(no, action, result, node, op, opinion, mi);
GO
-- 分发责任人(四个受控文件各一个责任人)
INSERT INTO rd_dev_task (产品编号, 产品名称, 源单据号, 目标面板, 下发人, 下发时间, 负责人, asp_user1, asp_time1)
SELECT v.产品编号, v.产品名称, v.源单据号, v.目标面板, N'glm53', GETDATE(), v.负责人, N'glm53', GETDATE()
FROM (VALUES
  (N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'DEMO-PI-001', N'RD_MOLD_PROC', N'cp'),
  (N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'DEMO-PI-001', N'RD_ASM_PROC',  N'glm53'),
  (N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'DEMO-PI-001', N'RD_SPEC_DOC',  N'cp'),
  (N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'DEMO-PI-001', N'RD_INSP_PLAN', N'glm53'),
  (N'DEMO-B-001', N'碱性炭棒滤芯(演示)',     N'DEMO-PI-002', N'RD_MOLD_PROC', N'cp'),
  (N'DEMO-B-001', N'碱性炭棒滤芯(演示)',     N'DEMO-PI-002', N'RD_ASM_PROC',  N'glm53'),
  (N'DEMO-B-001', N'碱性炭棒滤芯(演示)',     N'DEMO-PI-002', N'RD_SPEC_DOC',  N'cp'),
  (N'DEMO-B-001', N'碱性炭棒滤芯(演示)',     N'DEMO-PI-002', N'RD_INSP_PLAN', N'glm53')
) AS v(产品编号, 产品名称, 源单据号, 目标面板, 负责人);
GO

-- ═══════════════ 3. 四个受控文件(每个产品各一套,全部已归档) ═══════════════
DECLARE @today nvarchar(40) = CONVERT(nvarchar(10), GETDATE(), 120);
-- 3.1 成型工艺清单(表区:配方表=成型配方页 / 修订记录页)
INSERT INTO rd_mold_proc_head (单据编号, 单据日期, 产品编号, 产品名称, asp_user1, asp_time1)
VALUES
 (N'DEMO-MP-001', @today, N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'cp', GETDATE()),
 (N'DEMO-MP-002', @today, N'DEMO-B-001', N'碱性炭棒滤芯(演示)',     N'cp', GETDATE());
INSERT INTO rd_mold_proc_detail (单据编号, 表区, 序号, 物料种类, 物料名称, 实际添加比例, 单支物料含量, asp_user1, asp_time1)
VALUES
 (N'DEMO-MP-001', N'配方表', N'1', N'粉料', N'椰壳活性炭粉', N'0.62', N'1.35', N'cp', GETDATE()),
 (N'DEMO-MP-001', N'配方表', N'2', N'胶粉', N'聚乙烯胶粉',   N'0.25', N'0.54', N'cp', GETDATE()),
 (N'DEMO-MP-001', N'配方表', N'3', N'折算物料', N'造孔剂',   N'0.13', N'0.28', N'cp', GETDATE()),
 (N'DEMO-MP-002', N'配方表', N'1', N'粉料', N'椰壳活性炭粉', N'0.58', N'1.26', N'cp', GETDATE()),
 (N'DEMO-MP-002', N'配方表', N'2', N'胶粉', N'聚乙烯胶粉',   N'0.27', N'0.59', N'cp', GETDATE());
-- 3.2 组装工艺清单(表区:物料清单=BOM页 / 关键控制清单=工序页 / 修订记录页)
INSERT INTO rd_asm_proc_head (单据编号, 单据日期, 产品编号, 产品名称, asp_user1, asp_time1)
VALUES
 (N'DEMO-AP-001', @today, N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'glm53', GETDATE()),
 (N'DEMO-AP-002', @today, N'DEMO-B-001', N'碱性炭棒滤芯(演示)',     N'glm53', GETDATE());
INSERT INTO rd_asm_proc_detail (单据编号, 表区, 物料名, 用量, 备注, asp_user1, asp_time1)
VALUES
 (N'DEMO-AP-001', N'物料清单', N'炭棒(半成品)', N'1',   N'', N'glm53', GETDATE()),
 (N'DEMO-AP-001', N'物料清单', N'O型密封圈',    N'2',   N'', N'glm53', GETDATE()),
 (N'DEMO-AP-001', N'物料清单', N'滤芯外壳',     N'1',   N'', N'glm53', GETDATE()),
 (N'DEMO-AP-002', N'物料清单', N'炭棒(半成品)', N'1',   N'', N'glm53', GETDATE()),
 (N'DEMO-AP-002', N'物料清单', N'滤芯外壳',     N'1',   N'', N'glm53', GETDATE());
-- 3.3 规格书(⚠ 本面板「编号」= 产品编号,查询/门禁/变更复制都按它关联;单据号另用 DEMO-SD-*)
INSERT INTO rd_spec_doc_head (单据编号, 单据日期, 编号, 名称, 规格书种类, 整体规格参数, asp_user1, asp_time1)
VALUES
 (N'DEMO-SD-001', @today, N'DEMO-A-001', N'除重金属炭棒滤芯(演示)', N'产品规格书', N'外径 30.0mm × 长度 120mm,过滤精度 5μm', N'cp', GETDATE()),
 (N'DEMO-SD-002', @today, N'DEMO-B-001', N'碱性炭棒滤芯(演示)',     N'产品规格书', N'外径 30.0mm × 长度 120mm,pH 提升 ≥ 0.5', N'cp', GETDATE());
-- 3.4 出货检验计划表(表区用「检验类别」分块:必测项 / 型式检验)
INSERT INTO rd_insp_plan_head (单据编号, 单据日期, 产品编号, 标题, asp_user1, asp_time1)
VALUES
 (N'DEMO-IP-001', @today, N'DEMO-A-001', N'除重金属炭棒滤芯(演示) 出货检验项目控制计划', N'glm53', GETDATE()),
 (N'DEMO-IP-002', @today, N'DEMO-B-001', N'碱性炭棒滤芯(演示) 出货检验项目控制计划',     N'glm53', GETDATE());
INSERT INTO rd_insp_plan_detail (单据编号, 检验类别, 序号, 控制项目, 控制标准及要求, 控制方法, 备注, asp_user1, asp_time1)
VALUES
 (N'DEMO-IP-001', N'必测项', N'1', N'外观', N'表面无破损、无变形', N'目视', N'', N'glm53', GETDATE()),
 (N'DEMO-IP-001', N'必测项', N'2', N'尺寸', N'外径 30.0±0.2mm',     N'卡尺', N'', N'glm53', GETDATE()),
 (N'DEMO-IP-002', N'必测项', N'1', N'外观', N'表面无破损、无变形', N'目视', N'', N'glm53', GETDATE());
GO
-- 四文件状态行(已归档)+ 审批留痕
INSERT INTO yj_doc_status (panel_code, doc_no, saved, archived, pending, shr, shsj)
SELECT v.panel, v.no, 'Y', 'Y', 'N', N'admin', GETDATE()
FROM (VALUES
  (N'RD_MOLD_PROC', N'DEMO-MP-001'), (N'RD_MOLD_PROC', N'DEMO-MP-002'),
  (N'RD_ASM_PROC',  N'DEMO-AP-001'), (N'RD_ASM_PROC',  N'DEMO-AP-002'),
  (N'RD_SPEC_DOC',  N'DEMO-SD-001'), (N'RD_SPEC_DOC',  N'DEMO-SD-002'),
  (N'RD_INSP_PLAN', N'DEMO-IP-001'), (N'RD_INSP_PLAN', N'DEMO-IP-002')
) AS v(panel, no);
GO
INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)
SELECT v.panel, v.no, N'SUBMIT', N'PENDING', 1, v.actor, N'', DATEADD(minute, -30, GETDATE())
FROM (VALUES
  (N'RD_MOLD_PROC', N'DEMO-MP-001', N'cp'),  (N'RD_MOLD_PROC', N'DEMO-MP-002', N'cp'),
  (N'RD_ASM_PROC',  N'DEMO-AP-001', N'glm53'), (N'RD_ASM_PROC', N'DEMO-AP-002', N'glm53'),
  (N'RD_SPEC_DOC',  N'DEMO-SD-001', N'cp'),  (N'RD_SPEC_DOC', N'DEMO-SD-002', N'cp'),
  (N'RD_INSP_PLAN', N'DEMO-IP-001', N'glm53'), (N'RD_INSP_PLAN', N'DEMO-IP-002', N'glm53')
) AS v(panel, no, actor);
GO
INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)
SELECT v.panel, v.no, N'APPROVE', N'APPROVED', 1, N'admin', N'同意归档', DATEADD(minute, -10, GETDATE())
FROM (VALUES
  (N'RD_MOLD_PROC', N'DEMO-MP-001'), (N'RD_MOLD_PROC', N'DEMO-MP-002'),
  (N'RD_ASM_PROC',  N'DEMO-AP-001'), (N'RD_ASM_PROC',  N'DEMO-AP-002'),
  (N'RD_SPEC_DOC',  N'DEMO-SD-001'), (N'RD_SPEC_DOC',  N'DEMO-SD-002'),
  (N'RD_INSP_PLAN', N'DEMO-IP-001'), (N'RD_INSP_PLAN', N'DEMO-IP-002')
) AS v(panel, no);
GO

-- ═══════════════ 4. 产品 A 上挂一张草稿态变更申请单(工作人员从它往下走) ═══════════════
DECLARE @today nvarchar(40) = CONVERT(nvarchar(10), GETDATE(), 120);
INSERT INTO rd_change_head (单据编号, 单据日期, 申请部门, 性质, 产品编号, 产品名称, 申请人, 申请日期,
                            变更事由, 验证数据, 变更文件, 需会签, 会签人, 原料数量, 原料处理方式,
                            半成品数量, 半成品处理方式, 成品数量, 成品处理方式, 密级, 文件管理人, 文件使用范围,
                            备注, asp_user1, asp_time1)
VALUES (N'DEMO-CHG-001', @today, N'产品开发部', N'变更', N'DEMO-A-001', N'除重金属炭棒滤芯(演示)',
        N'陈秀丽', @today,
        N'长度管控尺寸由 -0.1/+0.4mm 变更为 -0.2/+0.6mm（演示数据：可直接提交会签往下走）',
        N'试产 200 支，尺寸合格率 99.5%，压降无异常（演示数据）',
        N'成型工艺清单、规格书', N'是', N'glm53,demo_pinzhi',
        N'1.2 万支', N'继续使用', N'0.8 万支', N'返工', N'0.3 万支', N'待定',
        N'内部', N'系统管理员', N'公司内', N'演示数据：变更流程测试样例', N'cp', GETDATE());
GO
-- 7 个部门评审行(预置与建单一致;给"开发部"填一行示例,其余留空等人填)
INSERT INTO rd_change_detail (单据编号, 表区, 部门, 变更后内容, 签字, 日期, asp_user1, asp_time1)
SELECT N'DEMO-CHG-001', N'部门评审意见', v.dept, v.content, v.sign, v.dt, N'cp', GETDATE()
FROM (VALUES
  (N'开发部',     N'同意变更：模具芯棒直径同步改 12.02mm，图纸已更新（演示内容）', N'陈秀丽', CONVERT(nvarchar(10), GETDATE(), 120)),
  (N'成型工艺科', N'', N'', N''),
  (N'组装车间',   N'', N'', N''),
  (N'销售部',     N'', N'', N''),
  (N'品质部',     N'', N'', N''),
  (N'计划组',     N'', N'', N''),
  (N'仓管部',     N'', N'', N'')
) AS v(dept, content, sign, dt);
GO
INSERT INTO yj_doc_status (panel_code, doc_no, saved, pending)
VALUES (N'RD_CHANGE', N'DEMO-CHG-001', 'Y', 'N');
GO

-- ═══════════════ 5. 灌完自查 ═══════════════
SELECT N'产品信息表(演示)' AS 项, COUNT(*) AS 行数 FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'四文件(演示)', (SELECT COUNT(*) FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%')
                                 + (SELECT COUNT(*) FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%')
                                 + (SELECT COUNT(*) FROM rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%')
                                 + (SELECT COUNT(*) FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%')
UNION ALL SELECT N'责任人分工行', COUNT(*) FROM rd_dev_task WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'变更单+部门行', (SELECT COUNT(*) FROM rd_change_head WHERE 产品编号 LIKE N'DEMO-%')
                                 + (SELECT COUNT(*) FROM rd_change_detail WHERE 单据编号 LIKE N'DEMO-%')
UNION ALL SELECT N'部门演示账号', COUNT(*) FROM yj_user WHERE username LIKE N'demo[_]%'
UNION ALL SELECT N'已归档演示单(DEMO-* 状态行)', COUNT(*) FROM yj_doc_status WHERE archived = 'Y' AND doc_no LIKE N'DEMO-%';
GO
PRINT N'seed-demo-prodfile 完成:两个演示产品(含四受控文件已归档+责任人已分发)+ 一张草稿态变更申请单 + 六个部门演示账号';
GO
