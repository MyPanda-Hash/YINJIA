-- migrate-drop-unused-tables.sql — 未用表清理 + 悬空面板元数据回收(2026-09-29 用户拍板)
--
-- 背景:HSDZ_MES 由外部数据库包(经典 HSDZ/ERP)+ 长期迭代叠加而成,库内 454 表里大量表项目并不使用。
--   本脚本按四源审计(① yj_panel 面板绑定且面板在运营 ② 在运营视图依赖 ③ backend/src/main/java +
--   frontend/src 运行期 SQL 引用 ④ 业务数据行)判定「未用」后物理删除,并回收连带悬空的面板元数据。
-- 证据与清单:tools/archive/_table-audit/(objects|panels|deps|refs|granted|classify|drop-risk|drop-tables|drop-plan)
-- 本次删除 244 张表:
--   · 仅被已下架面板挂靠 29 张(pr_* 25 + wo_line_stock/wo_material_pick/wo_stage_report + dm_ywy)
--   · 有数据但无任何引用 68 张(老 HSDZ 遗留:area_*/dm_py/s_sys/permission/kjkm… 合计约 2.6 万行)
--   · 空表未接线 20 张(rd_* 旧单表 19 + wo_report(源码注释「停用为遗留表」))
--   · 空表遗留未用 62 张 + 备份/临时 66 张(RENAME_*/_bak_*/tmp_*/t1/t2/log)
-- 例外保留(逐条有据,勿顺手删):
--   yj_schema_log —— tools/DbSync.java 的迁移登记表;删掉会让整条迁移链按「未执行」全量重跑
--   erp_imp_row   —— 与在用面板 ERPLG 同属 ERP 导入通道,本仓库无导入代码,可能由外部程序写入(0 行)
--   dm_key        —— 含明文接口密钥,属「要脱敏的历史资产」,单独处置
-- 联动:29 个已下架面板的 yj_field/yj_role_panel/yj_panel 行与仅它们使用的中文标签译名词条一并回收
--   (不回收 ⇒ 面板指向不存在的表,DbNormAudit 06 项直接 FAIL)。
-- 幂等:每步都有存在性守卫;新库场景 = 迁移链先建后删,历史脚本一律不回改(migrate-line-open-drop.sql 先例)。
-- 备份:执行前已打全库备份 deploy\HSDZ_MES_pre_drop_<时间戳>.bak(74MB,RESTORE VERIFYONLY 通过)。
-- 注:被删表若有遗留视图(View_llrk*/VIEW_zc 等 14 个,自身已无面板绑定)引用,那些视图会失效——
--   本脚本不动视图,失效清单见执行输出(dump-views),清理另立任务。

SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ── 1. 回收已下架面板的元数据(字段行 → 授权行 → 面板行 → 仅它们使用的译名词条) ──
DECLARE @panel TABLE (code sysname PRIMARY KEY);
INSERT INTO @panel (code) VALUES
  (N'PR_ASM_DAILY'),
  (N'PR_ASM_INCOMING'),
  (N'PR_ASM_RETURN'),
  (N'PR_BLACK_TEST'),
  (N'PR_CUT_DAILY'),
  (N'PR_DEMOLD_QC'),
  (N'PR_EFFICIENCY'),
  (N'PR_FLOW_CARD'),
  (N'PR_FORM_DAILY'),
  (N'PR_FORM_FIRST'),
  (N'PR_MAINTENANCE'),
  (N'PR_MAT_INSPECT'),
  (N'PR_MIX_BLEND'),
  (N'PR_MIX_CHECK'),
  (N'PR_MIX_CONFIRM'),
  (N'PR_MIX_DAILY'),
  (N'PR_MIX_FEED'),
  (N'PR_MIX_GRANULE'),
  (N'PR_MIX_PROCESS'),
  (N'PR_NO_BLACK'),
  (N'PR_PACK_CONFIRM'),
  (N'PR_PATROL_QC'),
  (N'PR_QC_CONTROL'),
  (N'PR_SCRAP'),
  (N'PR_SINTER_QC'),
  (N'WO_LINE'),
  (N'WO_PICK'),
  (N'WO_STAGE'),
  (N'YWYDA');

DECLARE @pname TABLE (name nvarchar(120) PRIMARY KEY);
INSERT INTO @pname (name) SELECT p.panel_name FROM yj_panel p JOIN @panel d ON d.code = p.panel_code;
DECLARE @plabel TABLE (label nvarchar(200) PRIMARY KEY);
INSERT INTO @plabel (label) SELECT DISTINCT f.label FROM yj_field f JOIN @panel d ON d.code = f.panel_code WHERE f.label IS NOT NULL;

DELETE f FROM yj_field f JOIN @panel d ON d.code = f.panel_code;
DECLARE @nField int = @@ROWCOUNT;
DELETE rp FROM yj_role_panel rp JOIN @panel d ON d.code = rp.panel_code;
DECLARE @nGrant int = @@ROWCOUNT;
DELETE p FROM yj_panel p JOIN @panel d ON d.code = p.panel_code;
DECLARE @nPanel int = @@ROWCOUNT;
-- 译名词条:只删「已无任何存活面板/字段引用」的(标签与面板名是全局共享键,不能按面板直接删)
DELETE t FROM yj_translation t
  WHERE t.scope = N'field' AND EXISTS (SELECT 1 FROM @plabel l WHERE l.label = t.ref_key)
    AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.label = t.ref_key);
DECLARE @nTf int = @@ROWCOUNT;
DELETE t FROM yj_translation t
  WHERE t.scope = N'panel' AND EXISTS (SELECT 1 FROM @pname n WHERE n.name = t.ref_key)
    AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = t.ref_key);
DECLARE @nTp int = @@ROWCOUNT;
PRINT N'面板元数据回收: 字段 ' + CAST(@nField AS nvarchar(10)) + N' , 授权 ' + CAST(@nGrant AS nvarchar(10))
      + N' , 面板 ' + CAST(@nPanel AS nvarchar(10)) + N' , 字段译名 ' + CAST(@nTf AS nvarchar(10)) + N' , 面板译名 ' + CAST(@nTp AS nvarchar(10));
GO

-- ── 2. 物理删除 244 张未用表(显式清单,勿改成谓词) ──
DECLARE @dropped int = 0;
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[Invoice]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.OdSample_bs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[OdSample_bs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.OdSample_wl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[OdSample_wl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.OrderSample', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[OrderSample]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_approval_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_approval_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_approval_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_approval_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_dom_test_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_dom_test_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_dom_test_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_dom_test_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_equip_use_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_equip_use_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_equip_use_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_equip_use_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_insp_plan_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_insp_plan_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_insp_plan_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_insp_plan_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_instr_use_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_instr_use_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_instr_use_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_instr_use_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_plan_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_plan_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_plan_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_plan_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_prod_info_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_prod_info_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_prod_info_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_prod_info_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_spike_water_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_spike_water_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_rd_spike_water_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_rd_spike_water_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_yj_doc_modify_log_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_yj_doc_modify_log_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173159_yj_doc_status_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173159_yj_doc_status_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_approval_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_approval_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_approval_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_approval_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_dom_test_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_dom_test_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_dom_test_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_dom_test_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_equip_use_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_equip_use_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_equip_use_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_equip_use_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_insp_plan_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_insp_plan_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_insp_plan_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_insp_plan_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_instr_use_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_instr_use_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_instr_use_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_instr_use_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_plan_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_plan_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_plan_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_plan_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_prod_info_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_prod_info_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_prod_info_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_prod_info_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_spike_water_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_spike_water_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_rd_spike_water_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_rd_spike_water_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_yj_doc_modify_log_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_yj_doc_modify_log_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_173205_yj_doc_status_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_173205_yj_doc_status_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.RENAME_20260911_213754_yj_doc_status_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[RENAME_20260911_213754_yj_doc_status_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.address', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[address]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.area_city', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[area_city]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.area_code', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[area_code]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.area_country', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[area_country]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.area_district', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[area_district]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.area_province', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[area_province]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.bacord', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[bacord]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.bxsq', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[bxsq]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.cbhs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[cbhs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.chdcmx', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[chdcmx]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.chsq', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[chsq]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.chtz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[chtz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.computer', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[computer]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.cp_barcode', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[cp_barcode]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.cpfpmx', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[cpfpmx]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dh', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dh]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_dbzsd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_dbzsd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_fylb', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_fylb]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_gfjj', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_gfjj]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_gx', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_gx]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_gz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_gz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_jjlb', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_jjlb]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_khgjjl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_khgjjl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_khlxr', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_khlxr]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_khsj', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_khsj]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_khzl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_khzl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_ks', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_ks]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_langue', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_langue]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_myjj', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_myjj]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_py', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_py]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_style', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_style]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_sys', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_sys]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_tax', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_tax]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_wz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_wz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_wzbacord', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_wzbacord]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_wzddw', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_wzddw]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_wzlb', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_wzlb]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_wzsx', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_wzsx]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_xl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_xl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_yh', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_yh]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_ywy', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_ywy]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_ywylb', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_ywylb]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_zjfl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_zjfl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dm_zw', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dm_zw]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.dorder', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[dorder]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.fgjl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[fgjl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.fgjl_ls', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[fgjl_ls]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.fgjlhz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[fgjlhz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.flash', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[flash]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.from_excel', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[from_excel]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.gdzc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[gdzc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.gscs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[gscs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.gssp', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[gssp]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.gszl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[gszl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.gzb', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[gzb]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.gzffjl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[gzffjl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.gzzc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[gzzc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.huiyuan', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[huiyuan]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.huiyuan_hz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[huiyuan_hz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.jgsd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[jgsd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.jrhz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[jrhz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.jrhz_ls', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[jrhz_ls]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.jyd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[jyd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.jyd_bs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[jyd_bs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.khts', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[khts]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kjkm', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kjkm]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kjpz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kjpz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kjpz_bs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kjpz_bs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kmye', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kmye]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kqbc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kqbc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kqewm', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kqewm]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kqjjr', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kqjjr]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kqqjd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kqqjd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kqsj', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kqsj]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kqsj_ls', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kqsj_ls]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.kqyc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[kqyc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.log', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[log]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.mate_jtsh', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[mate_jtsh]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.odprice_bs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[odprice_bs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.odprice_bt', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[odprice_bt]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.order1', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[order1]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pandian', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pandian]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pd_history', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pd_history]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pd_zzp', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pd_zzp]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pd_zzphistory', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pd_zzphistory]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pd_zzprq', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pd_zzprq]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.permission', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[permission]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pjjl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pjjl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pjjl_sz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pjjl_sz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_asm_daily', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_asm_daily]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_asm_incoming', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_asm_incoming]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_asm_return', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_asm_return]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_black_test', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_black_test]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_cut_daily', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_cut_daily]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_demold_qc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_demold_qc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_efficiency', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_efficiency]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_flow_card', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_flow_card]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_form_daily', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_form_daily]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_form_first', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_form_first]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_maintenance', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_maintenance]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mat_inspect', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mat_inspect]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mix_blend', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mix_blend]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mix_check', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mix_check]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mix_confirm', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mix_confirm]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mix_daily', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mix_daily]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mix_feed', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mix_feed]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mix_granule', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mix_granule]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_mix_process', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_mix_process]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_no_black', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_no_black]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_pack_confirm', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_pack_confirm]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_patrol_qc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_patrol_qc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_qc_control', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_qc_control]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_scrap', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_scrap]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pr_sinter_qc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pr_sinter_qc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.pzfk', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[pzfk]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.qkd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[qkd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_alkaline', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_alkaline]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_antibact', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_antibact]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_approval_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_approval_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_approval_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_approval_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_asm_bom', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_asm_bom]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_asm_bom_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_asm_bom_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_asm_bom_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_asm_bom_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_asm_proc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_asm_proc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_dom_test', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_dom_test]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_dom_test_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_dom_test_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_dom_test_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_dom_test_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_drop_prec', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_drop_prec]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_equip_use', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_equip_use]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_equip_use_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_equip_use_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_equip_use_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_equip_use_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_filter_eff', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_filter_eff]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_insp_plan', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_insp_plan]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_insp_plan_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_insp_plan_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_insp_plan_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_insp_plan_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_instr_use', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_instr_use]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_instr_use_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_instr_use_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_instr_use_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_instr_use_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_mineral', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_mineral]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_mold_formula', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_mold_formula]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_mold_formula_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_mold_formula_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_mold_formula_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_mold_formula_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_mold_proc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_mold_proc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_plan_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_plan_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_plan_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_plan_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_prod_info_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_prod_info_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_prod_info_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_prod_info_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_product_info', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_product_info]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_progress_detail_bak_20260918', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_progress_detail_bak_20260918]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_ro_protect', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_ro_protect]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_scale', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_scale]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_soak', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_soak]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_spec_doc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_spec_doc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_spike_water', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_spike_water]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_spike_water_detail_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_spike_water_detail_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.rd_spike_water_head_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[rd_spike_water_head_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_SelWhere', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_SelWhere]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_commdata', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_commdata]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_cookie', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_cookie]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_error', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_error]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_fromexcel', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_fromexcel]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_otherfunc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_otherfunc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_phrase', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_phrase]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_remoteprint', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_remoteprint]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_repbody', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_repbody]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_repdraw', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_repdraw]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_repformat', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_repformat]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_repheader', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_repheader]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_repinfo', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_repinfo]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_roles', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_roles]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_rzxz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_rzxz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_screen', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_screen]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_sys', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_sys]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_xtcs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_xtcs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.s_ycdy', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[s_ycdy]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.scjd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[scjd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.scjd_ls', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[scjd_ls]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.scpc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[scpc]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.scrb', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[scrb]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.scrb_bs', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[scrb_bs]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.sczxd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[sczxd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.setdate', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[setdate]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.sfkcz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[sfkcz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.sfkmx', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[sfkmx]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.t1', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[t1]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.t2', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[t2]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.tmp_excel', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[tmp_excel]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.tmp_report', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[tmp_report]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.tmp_report_head', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[tmp_report_head]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[users]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.wbgd', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[wbgd]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.wlxx', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[wlxx]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.wo_line_stock', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[wo_line_stock]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.wo_material_pick', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[wo_material_pick]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.wo_report', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[wo_report]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.wo_stage_report', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[wo_stage_report]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.xjjl', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[xjjl]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.xjjl_sz', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[xjjl_sz]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.xsdh', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[xsdh]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.yj_doc_modify_log_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[yj_doc_modify_log_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.yj_doc_status_bak_20260911', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[yj_doc_status_bak_20260911]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.ysfk', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[ysfk]; SET @dropped += 1; END
IF OBJECT_ID(N'dbo.zc', N'U') IS NOT NULL BEGIN DROP TABLE dbo.[zc]; SET @dropped += 1; END
PRINT N'未用表删除: ' + CAST(@dropped AS nvarchar(10)) + N' 张';
GO

-- ── 3. 执行后核对(三项都应如注释所示) ──
SELECT N'剩余表数(预期 210)' AS 检查项, COUNT(*) AS 值 FROM sys.tables;
SELECT N'指向不存在对象的面板(预期 0)' AS 检查项, COUNT(*) AS 值 FROM yj_panel
  WHERE (line_table IS NOT NULL AND OBJECT_ID(line_table) IS NULL)
     OR (head_table IS NOT NULL AND OBJECT_ID(head_table) IS NULL);
SELECT N'剩余备份/临时表(预期 0;口径同 DbNormAudit.isBackup)' AS 检查项, COUNT(*) AS 值 FROM sys.tables
  WHERE LOWER(name) LIKE '%bak%' OR LOWER(name) LIKE 'rename%' OR LOWER(name) LIKE 'tmp%' OR LOWER(name) LIKE 't[0-9]';
GO
