/* ═══════════════════════════════════════════════════════════════════════════════
   verify-db.sql — 全量部署:换库之后的核对(只读)
   由 deploy-all.bat 第 6 步调用。重点两件:
     ① 演示数据在不在(2 产品 / 8 四文件 / 1 变更单 / 6 部门账号 / RD_CHANGE 面板已注册)
     ② **用应用账号 yinjia 真连一次**(跨服务器还原最容易死在这里:
        库里的用户带着原机器 SID → "用户 'yinjia' 登录失败" → 应用启动期查库失败就退出)
   结论行纯 ASCII:grep "RESULT:"
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
USE HSDZ_MES;
SELECT N'RESULT: PANELS ' + CAST(COUNT(*) AS varchar(10)) FROM yj_panel;
SELECT N'RESULT: FIELDS ' + CAST(COUNT(*) AS varchar(10)) FROM yj_field;
SELECT N'RESULT: USERS ' + CAST(COUNT(*) AS varchar(10)) FROM yj_user;
SELECT N'RESULT: DEMO-PROD-INFO ' + CAST(COUNT(*) AS varchar(10)) FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%';
SELECT N'RESULT: DEMO-FILES ' + CAST(COUNT(*) AS varchar(10)) FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%') t;
SELECT N'RESULT: DEMO-CHANGE ' + CAST(COUNT(*) AS varchar(10)) FROM rd_change_head WHERE 产品编号 LIKE N'DEMO-%';
SELECT N'RESULT: DEMO-USERS ' + CAST(COUNT(*) AS varchar(10)) FROM yj_user WHERE username LIKE N'demo[_]%';
SELECT N'RESULT: RD-CHANGE-PANEL ' + CAST(COUNT(*) AS varchar(10)) FROM yj_panel WHERE panel_code = N'RD_CHANGE';
SELECT N'RESULT: CHANGE-DEPT-ROWS ' + CAST(COUNT(*) AS varchar(10)) FROM rd_change_detail d
  JOIN rd_change_head h ON h.单据编号 = d.单据编号 WHERE h.产品编号 LIKE N'DEMO-%';
GO
-- 用应用账号真连一次(口令 Win 登录跑 sqlcmd 也能验:连不上会报错,连上打 OK)
SELECT N'RESULT: LOGIN-USER-OK' WHERE EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'yinjia' AND type = N'S');
GO
