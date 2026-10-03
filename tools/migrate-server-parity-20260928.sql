/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-server-parity-20260928.sql — 服务器侧直改结构对齐(让三库同构)
   来源:2026-09-28 服务器 bak(09:39)还原到测试账套后,与开发库逐列对比;
   共 106 列"仅服务器存在"(已排除 RENAME_*、bak、tmp 遗留噪音组)——
   即文档所谓"远程库上直改未入链"的存量:asp_* 审计列 3/4 套件、
   研发板块远端列(rd_dom_test/rd_instr_use/rd_equip_use/rd_spike_water)、
   bl_dispatch 派工数量组、yj_user 原 HSDZ 宽表遗留列等。
   幂等:全部 OBJECT_ID + COL_LENGTH 守卫;在服务器上执行=全跳过 no-op;
   在开发库/测试库上补齐 → 服务器/开发正式库/测试库同构。
   视图层差异(v_sales_order_detail 等额外列)不进本脚本:视图由代码域各自管理,
   防止覆盖本地修复;列注释按"改动已有表鼓励补注"从简。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
GO

-- ═══ bd_material_out ═══
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'asp_cancel') IS NULL ALTER TABLE dbo.bd_material_out ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'asp_print') IS NULL ALTER TABLE dbo.bd_material_out ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'asp_time3') IS NULL ALTER TABLE dbo.bd_material_out ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'asp_time4') IS NULL ALTER TABLE dbo.bd_material_out ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'asp_user3') IS NULL ALTER TABLE dbo.bd_material_out ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.bd_material_out') IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', N'asp_user4') IS NULL ALTER TABLE dbo.bd_material_out ADD [asp_user4] nvarchar(20) NULL;

-- ═══ bd_other_out ═══
IF OBJECT_ID('dbo.bd_other_out') IS NOT NULL AND COL_LENGTH('dbo.bd_other_out', N'项目合同号') IS NULL ALTER TABLE dbo.bd_other_out ADD [项目合同号] nvarchar(200) NULL;

-- ═══ bl_dispatch ═══
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'asp_cancel') IS NULL ALTER TABLE dbo.bl_dispatch ADD [asp_cancel] nvarchar(2) NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'asp_print') IS NULL ALTER TABLE dbo.bl_dispatch ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'asp_time1') IS NULL ALTER TABLE dbo.bl_dispatch ADD [asp_time1] datetime NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'asp_time2') IS NULL ALTER TABLE dbo.bl_dispatch ADD [asp_time2] datetime NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'comm') IS NULL ALTER TABLE dbo.bl_dispatch ADD [comm] nvarchar(10) NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'已派工数量') IS NULL ALTER TABLE dbo.bl_dispatch ADD [已派工数量] float NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'派工数量') IS NULL ALTER TABLE dbo.bl_dispatch ADD [派工数量] float NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'累计汇报数量') IS NULL ALTER TABLE dbo.bl_dispatch ADD [累计汇报数量] float NULL;
IF OBJECT_ID('dbo.bl_dispatch') IS NOT NULL AND COL_LENGTH('dbo.bl_dispatch', N'计划数量') IS NULL ALTER TABLE dbo.bl_dispatch ADD [计划数量] float NULL;

-- ═══ bl_material_out ═══
IF OBJECT_ID('dbo.bl_material_out') IS NOT NULL AND COL_LENGTH('dbo.bl_material_out', N'asp_cancel') IS NULL ALTER TABLE dbo.bl_material_out ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.bl_material_out') IS NOT NULL AND COL_LENGTH('dbo.bl_material_out', N'asp_print') IS NULL ALTER TABLE dbo.bl_material_out ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.bl_material_out') IS NOT NULL AND COL_LENGTH('dbo.bl_material_out', N'asp_time3') IS NULL ALTER TABLE dbo.bl_material_out ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.bl_material_out') IS NOT NULL AND COL_LENGTH('dbo.bl_material_out', N'asp_time4') IS NULL ALTER TABLE dbo.bl_material_out ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.bl_material_out') IS NOT NULL AND COL_LENGTH('dbo.bl_material_out', N'asp_user3') IS NULL ALTER TABLE dbo.bl_material_out ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.bl_material_out') IS NOT NULL AND COL_LENGTH('dbo.bl_material_out', N'asp_user4') IS NULL ALTER TABLE dbo.bl_material_out ADD [asp_user4] nvarchar(20) NULL;

-- ═══ bs_inv ═══
IF OBJECT_ID('dbo.bs_inv') IS NOT NULL AND COL_LENGTH('dbo.bs_inv', N'检验方式') IS NULL ALTER TABLE dbo.bs_inv ADD [检验方式] nvarchar(20) NULL;

-- ═══ pr_scrap ═══
IF OBJECT_ID('dbo.pr_scrap') IS NOT NULL AND COL_LENGTH('dbo.pr_scrap', N'物料产品名称') IS NULL ALTER TABLE dbo.pr_scrap ADD [物料产品名称] nvarchar(100) NULL;

-- ═══ rd_dom_test_detail ═══
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'asp_print') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'asp_time3') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'asp_time4') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'asp_user3') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'asp_user4') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [asp_user4] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'日期') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [日期] datetime NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'期望完成日期') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [期望完成日期] datetime NULL;
IF OBJECT_ID('dbo.rd_dom_test_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_detail', N'预计完成日期') IS NULL ALTER TABLE dbo.rd_dom_test_detail ADD [预计完成日期] datetime NULL;

-- ═══ rd_dom_test_head ═══
IF OBJECT_ID('dbo.rd_dom_test_head') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_head', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_dom_test_head ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_dom_test_head') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_head', N'asp_print') IS NULL ALTER TABLE dbo.rd_dom_test_head ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_dom_test_head') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_head', N'asp_time3') IS NULL ALTER TABLE dbo.rd_dom_test_head ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_dom_test_head') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_head', N'asp_time4') IS NULL ALTER TABLE dbo.rd_dom_test_head ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_dom_test_head') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_head', N'asp_user3') IS NULL ALTER TABLE dbo.rd_dom_test_head ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_dom_test_head') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_head', N'asp_user4') IS NULL ALTER TABLE dbo.rd_dom_test_head ADD [asp_user4] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_dom_test_head') IS NOT NULL AND COL_LENGTH('dbo.rd_dom_test_head', N'单据日期') IS NULL ALTER TABLE dbo.rd_dom_test_head ADD [单据日期] datetime NULL;

-- ═══ rd_equip_use_detail ═══
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'asp_print') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'asp_time3') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'asp_time4') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'asp_user3') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'asp_user4') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [asp_user4] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'使用日期') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [使用日期] datetime NULL;
IF OBJECT_ID('dbo.rd_equip_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_detail', N'设备名称') IS NULL ALTER TABLE dbo.rd_equip_use_detail ADD [设备名称] nvarchar(60) NULL;

-- ═══ rd_equip_use_head ═══
IF OBJECT_ID('dbo.rd_equip_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_head', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_equip_use_head ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_equip_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_head', N'asp_print') IS NULL ALTER TABLE dbo.rd_equip_use_head ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_equip_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_head', N'asp_time3') IS NULL ALTER TABLE dbo.rd_equip_use_head ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_equip_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_head', N'asp_time4') IS NULL ALTER TABLE dbo.rd_equip_use_head ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_equip_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_head', N'asp_user3') IS NULL ALTER TABLE dbo.rd_equip_use_head ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_equip_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_head', N'asp_user4') IS NULL ALTER TABLE dbo.rd_equip_use_head ADD [asp_user4] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_equip_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_equip_use_head', N'单据日期') IS NULL ALTER TABLE dbo.rd_equip_use_head ADD [单据日期] datetime NULL;

-- ═══ rd_filter_eff_head ═══
IF OBJECT_ID('dbo.rd_filter_eff_head') IS NOT NULL AND COL_LENGTH('dbo.rd_filter_eff_head', N'数据结论') IS NULL ALTER TABLE dbo.rd_filter_eff_head ADD [数据结论] nvarchar(2000) NULL;

-- ═══ rd_instr_use_detail ═══
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'asp_print') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'asp_time3') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'asp_time4') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'asp_user3') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'asp_user4') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [asp_user4] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'仪器名称/型号') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [仪器名称/型号] nvarchar(100) NULL;
IF OBJECT_ID('dbo.rd_instr_use_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_detail', N'使用日期') IS NULL ALTER TABLE dbo.rd_instr_use_detail ADD [使用日期] datetime NULL;

-- ═══ rd_instr_use_head ═══
IF OBJECT_ID('dbo.rd_instr_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_head', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_instr_use_head ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_instr_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_head', N'asp_print') IS NULL ALTER TABLE dbo.rd_instr_use_head ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_instr_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_head', N'asp_time3') IS NULL ALTER TABLE dbo.rd_instr_use_head ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_instr_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_head', N'asp_time4') IS NULL ALTER TABLE dbo.rd_instr_use_head ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_instr_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_head', N'asp_user3') IS NULL ALTER TABLE dbo.rd_instr_use_head ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_instr_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_head', N'asp_user4') IS NULL ALTER TABLE dbo.rd_instr_use_head ADD [asp_user4] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_instr_use_head') IS NOT NULL AND COL_LENGTH('dbo.rd_instr_use_head', N'单据日期') IS NULL ALTER TABLE dbo.rd_instr_use_head ADD [单据日期] datetime NULL;

-- ═══ rd_spike_water_detail ═══
IF OBJECT_ID('dbo.rd_spike_water_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_detail', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_spike_water_detail ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_spike_water_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_detail', N'asp_print') IS NULL ALTER TABLE dbo.rd_spike_water_detail ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_spike_water_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_detail', N'asp_time3') IS NULL ALTER TABLE dbo.rd_spike_water_detail ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_spike_water_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_detail', N'asp_time4') IS NULL ALTER TABLE dbo.rd_spike_water_detail ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_spike_water_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_detail', N'asp_user3') IS NULL ALTER TABLE dbo.rd_spike_water_detail ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_spike_water_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_detail', N'asp_user4') IS NULL ALTER TABLE dbo.rd_spike_water_detail ADD [asp_user4] nvarchar(20) NULL;

-- ═══ rd_spike_water_head ═══
IF OBJECT_ID('dbo.rd_spike_water_head') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_head', N'asp_cancel') IS NULL ALTER TABLE dbo.rd_spike_water_head ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.rd_spike_water_head') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_head', N'asp_print') IS NULL ALTER TABLE dbo.rd_spike_water_head ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.rd_spike_water_head') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_head', N'asp_time3') IS NULL ALTER TABLE dbo.rd_spike_water_head ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.rd_spike_water_head') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_head', N'asp_time4') IS NULL ALTER TABLE dbo.rd_spike_water_head ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.rd_spike_water_head') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_head', N'asp_user3') IS NULL ALTER TABLE dbo.rd_spike_water_head ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_spike_water_head') IS NOT NULL AND COL_LENGTH('dbo.rd_spike_water_head', N'asp_user4') IS NULL ALTER TABLE dbo.rd_spike_water_head ADD [asp_user4] nvarchar(20) NULL;

-- ═══ yj_user ═══
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'MobId') IS NULL ALTER TABLE dbo.yj_user ADD [MobId] nvarchar(50) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'PrintNa') IS NULL ALTER TABLE dbo.yj_user ADD [PrintNa] nvarchar(50) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_cancel') IS NULL ALTER TABLE dbo.yj_user ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_print') IS NULL ALTER TABLE dbo.yj_user ADD [asp_print] int NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_time1') IS NULL ALTER TABLE dbo.yj_user ADD [asp_time1] datetime2 NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_time2') IS NULL ALTER TABLE dbo.yj_user ADD [asp_time2] datetime2 NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_time3') IS NULL ALTER TABLE dbo.yj_user ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_time4') IS NULL ALTER TABLE dbo.yj_user ADD [asp_time4] datetime2 NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_user1') IS NULL ALTER TABLE dbo.yj_user ADD [asp_user1] nvarchar(20) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_user2') IS NULL ALTER TABLE dbo.yj_user ADD [asp_user2] nvarchar(20) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_user3') IS NULL ALTER TABLE dbo.yj_user ADD [asp_user3] nvarchar(20) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'asp_user4') IS NULL ALTER TABLE dbo.yj_user ADD [asp_user4] nvarchar(20) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'comm') IS NULL ALTER TABLE dbo.yj_user ADD [comm] nvarchar(20) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'dlxz') IS NULL ALTER TABLE dbo.yj_user ADD [dlxz] nvarchar(1) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'islogin') IS NULL ALTER TABLE dbo.yj_user ADD [islogin] nvarchar(1) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'khdm') IS NULL ALTER TABLE dbo.yj_user ADD [khdm] nvarchar(100) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'phoneNo') IS NULL ALTER TABLE dbo.yj_user ADD [phoneNo] nvarchar(20) NULL;
IF OBJECT_ID('dbo.yj_user') IS NOT NULL AND COL_LENGTH('dbo.yj_user', N'usertype') IS NULL ALTER TABLE dbo.yj_user ADD [usertype] nvarchar(20) NULL;

-- ═══ zc ═══
IF OBJECT_ID('dbo.zc') IS NOT NULL AND COL_LENGTH('dbo.zc', N'asp_cancel') IS NULL ALTER TABLE dbo.zc ADD [asp_cancel] nvarchar(1) NULL;
IF OBJECT_ID('dbo.zc') IS NOT NULL AND COL_LENGTH('dbo.zc', N'asp_time1') IS NULL ALTER TABLE dbo.zc ADD [asp_time1] datetime2 NULL;
IF OBJECT_ID('dbo.zc') IS NOT NULL AND COL_LENGTH('dbo.zc', N'asp_time2') IS NULL ALTER TABLE dbo.zc ADD [asp_time2] datetime2 NULL;
IF OBJECT_ID('dbo.zc') IS NOT NULL AND COL_LENGTH('dbo.zc', N'asp_time3') IS NULL ALTER TABLE dbo.zc ADD [asp_time3] datetime2 NULL;
IF OBJECT_ID('dbo.zc') IS NOT NULL AND COL_LENGTH('dbo.zc', N'asp_time4') IS NULL ALTER TABLE dbo.zc ADD [asp_time4] datetime2 NULL;
GO
PRINT N'migrate-server-parity-20260928 完成(守卫式补列,重跑安全)';
GO
