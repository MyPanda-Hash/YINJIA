/* ==========================================================================
   migrate-erplg-cloud-push-20261019.sql

   ERP导入日志(ERPLG / ERPLG_ROW)补录 —— 把本机已登记的 9 个批次推到云端服务器。

   背景(2026-10-19 用户口径「推送到云端」):
     · 2026-10-18 按「去关联金蝶账号的数据写入,先把数据补充完整」补录过 9 个批次
       (商品/仓库/计量单位/部门/职员/客户/供应商 + 采购订单/销售订单,合计 10710 行;
        取证见 tools/archive/_dm-20261018/README.md),但那是本机脚本直接写库,
       **从未进过迁移链**,所以云端服务器(36.140.66.163)上 ERPLG 至今 0 行。
     · 本脚本把同样的 9 个批次做成**幂等补录**:走部署迁移链(或 DbSync run 单跑)即上云。

   铁律:
     ① 数据 = 本机现役行的原样转写(批次号/条数/备注/时间戳都不重算、不造数);
     ② 幂等:日志表按 [批次号]、行表按 ([批次号],[行号]) 判定 —— 重跑 0 新增,不会重复;
     ③ 只写 erp_imp_log / erp_imp_row 两张表;两张表不在(空库/结构未同步)整段 SKIP;
     ④ 尾部打印 RESULT: 行数自检,期望 log=9 / row=45。

   回退:DELETE FROM erp_imp_row WHERE [批次号] LIKE 'IMP-%';
         DELETE FROM erp_imp_log WHERE [批次号] LIKE 'IMP-%';
   ========================================================================== */
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.erp_imp_log', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.erp_imp_row', N'U') IS NOT NULL
BEGIN

    /* ── 日志表:9 个批次 ── */
    -- IMP-20261018-001 商品档案 / 3878 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-001')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-001', N'商品档案', N'商品档案-IMP-20261018-001.jsonl', 3878, 3878, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.210', N'金蝶账套测试沙箱 · /jdy/v2/bd/material · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.210', NULL, NULL, N'N');

    -- IMP-20261018-002 仓库档案 / 6 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-002')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-002', N'仓库档案', N'仓库档案-IMP-20261018-002.jsonl', 6, 6, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.227', N'金蝶账套测试沙箱 · /jdy/v2/bd/store · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.227', NULL, NULL, N'N');

    -- IMP-20261018-003 计量单位 / 26 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-003')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-003', N'计量单位', N'计量单位-IMP-20261018-003.jsonl', 26, 26, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.240', N'金蝶账套测试沙箱 · /jdy/v2/bd/measure_unit · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.240', NULL, NULL, N'N');

    -- IMP-20261018-004 部门档案 / 26 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-004')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-004', N'部门档案', N'部门档案-IMP-20261018-004.jsonl', 26, 26, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.247', N'金蝶账套测试沙箱 · /jdy/v2/bd/department · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.247', NULL, NULL, N'N');

    -- IMP-20261018-005 职员档案 / 128 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-005')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-005', N'职员档案', N'职员档案-IMP-20261018-005.jsonl', 128, 128, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.257', N'金蝶账套测试沙箱 · /jdy/v2/bd/emp · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.257', NULL, NULL, N'N');

    -- IMP-20261018-006 客户档案 / 233 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-006')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-006', N'客户档案', N'客户档案-IMP-20261018-006.jsonl', 233, 233, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.267', N'金蝶账套测试沙箱 · /jdy/v2/bd/customer · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.267', NULL, NULL, N'N');

    -- IMP-20261018-007 供应商档案 / 155 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-007')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-007', N'供应商档案', N'供应商档案-IMP-20261018-007.jsonl', 155, 155, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.277', N'金蝶账套测试沙箱 · /jdy/v2/bd/supplier · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.277', NULL, NULL, N'N');

    -- IMP-20261018-008 采购订单 / 2275 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-008')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-008', N'采购订单', N'采购订单-IMP-20261018-008.jsonl', 2275, 2275, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.287', N'金蝶账套测试沙箱 · /jdy/v2/scm/pur_order · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.287', NULL, NULL, N'N');

    -- IMP-20261018-009 销售订单 / 3983 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-009')
        INSERT INTO dbo.erp_imp_log ([批次号], [导入类型], [文件名], [总行数], [成功数], [失败数], [跳过数], [状态], [操作人], [导入时间], [备注], [asp_user1], [asp_time1], [asp_user2], [asp_time2], [asp_cancel])
        VALUES (N'IMP-20261018-009', N'销售订单', N'销售订单-IMP-20261018-009.jsonl', 3983, 3983, 0, 0, N'已入库', N'金蝶同步', '2026-10-18 09:58:47.297', N'金蝶账套测试沙箱 · /jdy/v2/scm/sal_order · 实例 580147507460444160', N'金蝶同步', '2026-10-18 09:58:47.297', NULL, NULL, N'N');

    /* ── 行表明细:按 [批次号] 取回各批次 id,再逐行补 ── */
    DECLARE @b20261018001 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-001');
    DECLARE @b20261018002 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-002');
    DECLARE @b20261018003 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-003');
    DECLARE @b20261018004 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-004');
    DECLARE @b20261018005 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-005');
    DECLARE @b20261018006 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-006');
    DECLARE @b20261018007 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-007');
    DECLARE @b20261018008 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-008');
    DECLARE @b20261018009 INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'IMP-20261018-009');

    -- IMP-20261018-001 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-001' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018001, N'IMP-20261018-001', 1, N'C-95-13', N'{"parent_name":"冰箱炭棒","number":"C-95-13","parent_number":"SPFL00013","parent_id":"2236463020798653440","name":"006项目/功能炭棒滤芯","id":"2350998447882071040","is_multi_unit":false,"is_serial":false,"is_asst_attr":false,"is_weight":false,"is_kf_period":false,"is_batch":false,"url":"","model":"57*21*66.5","barcode":"","is_show_aux_barcode":false,"mul_label":[{"id":"2479206810112873472","number":"2479206810112873472","name":"3-01-01-0234"}],"check_type":"1","brand_id":"","brand_name":"","brand_number":"","producing_pace":"","help_code":"3-01-01-0234","base_unit_id":"3","base_unit_number":"支","base_unit_name":"支","remark":"寿命:300 gallons\n流速:0.5 GPM\n过滤精度:0.5-1微米(不能超过1)\n去除物质:余氧、cyst、lead(要求满足NSF 42\\53性能)","units":[],"stock_id":"","stock_name":"","stock_number":"","pro_license":"","purchase_unit_id":"3","is_self_restraint":"false","short_name":""}', N'成功', NULL, N'bs_inv', N'C-95-13', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.213', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-001' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018001, N'IMP-20261018-001', 2, N'C-95-13**TB', N'{"parent_name":"冰箱炭棒","number":"C-95-13**TB","parent_number":"SPFL00013","parent_id":"2236463020798653440","name":"006项目/功能炭棒滤芯","id":"2350998674601006080","is_multi_unit":false,"is_serial":false,"is_asst_attr":false,"is_weight":false,"is_kf_period":false,"is_batch":false,"url":"","model":"57*21*66.5","barcode":"","is_show_aux_barcode":false,"mul_label":[],"check_type":"1","brand_id":"","brand_name":"","brand_number":"","producing_pace":"","help_code":"物料编码：3-01-01-0234","base_unit_id":"3","base_unit_number":"支","base_unit_name":"支","remark":"寿命:300 gallons\n流速:0.5 GPM\n过滤精度:0.5-1微米(不能超过1)\n去除物质:余氧、cyst、lead(要求满足NSF 42\\53性能)","units":[],"stock_id":"","stock_name":"","stock_number":"","pro_license":"","purchase_unit_id":"3","is_self_restraint":"false","short_name":""}', N'成功', NULL, N'bs_inv', N'C-95-13**TB', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.217', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-001' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018001, N'IMP-20261018-001', 3, N'C-95-14', N'{"parent_name":"冰箱炭棒","number":"C-95-14","parent_number":"SPFL00013","parent_id":"2236463020798653440","name":"006项目/功能炭棒滤芯","id":"2351000013741609984","is_multi_unit":false,"is_serial":false,"is_asst_attr":false,"is_weight":false,"is_kf_period":false,"is_batch":false,"url":"","model":"30*10*182","barcode":"","is_show_aux_barcode":false,"mul_label":[],"check_type":"1","brand_id":"","brand_name":"","brand_number":"","producing_pace":"","help_code":"3-01-01-0228","base_unit_id":"3","base_unit_number":"支","base_unit_name":"支","remark":"实测寿金:300 gallons、流速:0.5 GPM\n过滤精度:0.5-1微米(不能超过1)\n去除物质:余氧、cyst、lead (要求满足NSF 42\\53性能)","units":[],"stock_id":"","stock_name":"","stock_number":"","pro_license":"","purchase_unit_id":"3","is_self_restraint":"false","short_name":""}', N'成功', NULL, N'bs_inv', N'C-95-14', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.220', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-001' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018001, N'IMP-20261018-001', 4, N'C-95-14**TB', N'{"parent_name":"冰箱炭棒","number":"C-95-14**TB","parent_number":"SPFL00013","parent_id":"2236463020798653440","name":"006项目/功能炭棒滤芯","id":"2351000299918945280","is_multi_unit":false,"is_serial":false,"is_asst_attr":false,"is_weight":false,"is_kf_period":false,"is_batch":false,"url":"","model":"30*10*182","barcode":"","is_show_aux_barcode":false,"mul_label":[],"check_type":"1","brand_id":"","brand_name":"","brand_number":"","producing_pace":"","help_code":"物料编码：3-01-01-0228","base_unit_id":"3","base_unit_number":"支","base_unit_name":"支","remark":"实测寿金:300 gallons、流速:0.5 GPM\n过滤精度:0.5-1微米(不能超过1)\n去除物质:余氧、cyst、lead (要求满足NSF 42\\53性能)","units":[],"stock_id":"","stock_name":"","stock_number":"","pro_license":"","purchase_unit_id":"3","is_self_restraint":"false","short_name":""}', N'成功', NULL, N'bs_inv', N'C-95-14**TB', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.220', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-001' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018001, N'IMP-20261018-001', 5, N'C-95-15', N'{"parent_name":"冰箱炭棒","number":"C-95-15","parent_number":"SPFL00013","parent_id":"2236463020798653440","name":"006项目/功能炭棒滤芯","id":"2351000724004971520","is_multi_unit":false,"is_serial":false,"is_asst_attr":false,"is_weight":false,"is_kf_period":false,"is_batch":false,"url":"","model":"38*13*149","barcode":"","is_show_aux_barcode":false,"mul_label":[],"check_type":"1","brand_id":"","brand_name":"","brand_number":"","producing_pace":"","help_code":"3-01-01-0232","base_unit_id":"3","base_unit_number":"支","base_unit_name":"支","remark":"实测寿命:300 gallons、流速:0.5 GPM\n过滤精度:0.5-1微米(不能超过1)\n去除物质:余氧、cyst、lead(要求满足NSF 42\\53性能)","units":[],"stock_id":"","stock_name":"","stock_number":"","pro_license":"","purchase_unit_id":"3","is_self_restraint":"false","short_name":""}', N'成功', NULL, N'bs_inv', N'C-95-15', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.223', NULL, NULL);

    -- IMP-20261018-002 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-002' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018002, N'IMP-20261018-002', 1, N'YJ-08', N'{"id":"2174067714627325952","number":"YJ-08","name":"车间仓","group_name":"","group_id":"","group_number":"","is_allow_freight":false,"is_allow_neg":"false","enable":"1"}', N'成功', NULL, N'bs_wh', N'YJ-08', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.227', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-002' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018002, N'IMP-20261018-002', 2, N'CP-02', N'{"id":"2220441270411712512","number":"CP-02","name":"成品B仓","group_name":"","group_id":"","group_number":"","is_allow_freight":false,"is_allow_neg":"true","enable":"1"}', N'成功', NULL, N'bs_wh', N'CP-02', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.230', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-002' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018002, N'IMP-20261018-002', 3, N'CK00003', N'{"id":"2199600261708772352","number":"CK00003","name":"成品不良品区","group_name":"","group_id":"","group_number":"","is_allow_freight":false,"is_allow_neg":"false","enable":"1"}', N'成功', NULL, N'bs_wh', N'CK00003', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.230', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-002' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018002, N'IMP-20261018-002', 4, N'YCL-01', N'{"id":"2243772584451731456","number":"YCL-01","name":"恒亿仓","group_name":"","group_id":"","group_number":"","is_allow_freight":false,"is_allow_neg":"false","enable":"1"}', N'成功', NULL, N'bs_wh', N'YCL-01', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.233', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-002' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018002, N'IMP-20261018-002', 5, N'CK00006', N'{"id":"2436465656128978944","number":"CK00006","name":"华北工控仓","group_name":"","group_id":"","group_number":"","is_allow_freight":false,"is_allow_neg":"false","enable":"1"}', N'成功', NULL, N'bs_wh', N'CK00006', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.237', NULL, NULL);

    -- IMP-20261018-003 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-003' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018003, N'IMP-20261018-003', 1, N'cm', N'{"id":"9","number":"cm","name":"cm","precision":"0"}', N'成功', NULL, N'bs_uom', N'cm', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.240', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-003' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018003, N'IMP-20261018-003', 2, N'g', N'{"id":"6","number":"g","name":"g","precision":"0"}', N'成功', NULL, N'bs_uom', N'g', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.240', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-003' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018003, N'IMP-20261018-003', 3, N'kg', N'{"id":"7","number":"kg","name":"kg","precision":"3"}', N'成功', NULL, N'bs_uom', N'kg', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.243', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-003' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018003, N'IMP-20261018-003', 4, N'l', N'{"id":"10","number":"l","name":"L","precision":"0"}', N'成功', NULL, N'bs_uom', N'l', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.243', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-003' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018003, N'IMP-20261018-003', 5, N'ml', N'{"id":"11","number":"ml","name":"ml","precision":"0"}', N'成功', NULL, N'bs_uom', N'ml', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.247', NULL, NULL);

    -- IMP-20261018-004 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-004' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018004, N'IMP-20261018-004', 1, N'BM00016', N'{"id":"2219578381425563648","number":"BM00016","name":"1号车间 ","long_number":"100000!BM00016","full_name":"惠州市银嘉环保科技有限公司_1号车间 ","enable":"1","level":"1","is_leaf":true,"parent_id":"100000","parent_name":"惠州市银嘉环保科技有限公司","parent_number":"100000"}', N'成功', NULL, N'bs_dept', N'BM00016', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.250', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-004' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018004, N'IMP-20261018-004', 2, N'BM00015', N'{"id":"2210520052799727616","number":"BM00015","name":"X烧结车间","long_number":"100000!BM00015","full_name":"惠州市银嘉环保科技有限公司_X烧结车间","enable":"1","level":"1","is_leaf":true,"parent_id":"100000","parent_name":"惠州市银嘉环保科技有限公司","parent_number":"100000"}', N'成功', NULL, N'bs_dept', N'BM00015', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.250', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-004' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018004, N'IMP-20261018-004', 3, N'BM00010', N'{"id":"2171205237967249408","number":"BM00010","name":"办公室","long_number":"100000!BM00010","full_name":"惠州市银嘉环保科技有限公司_办公室","enable":"1","level":"1","is_leaf":true,"parent_id":"100000","parent_name":"惠州市银嘉环保科技有限公司","parent_number":"100000"}', N'成功', NULL, N'bs_dept', N'BM00010', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.253', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-004' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018004, N'IMP-20261018-004', 4, N'BM00019', N'{"id":"2250379810020903936","number":"BM00019","name":"博辰仓","long_number":"100000!BM00019","full_name":"惠州市银嘉环保科技有限公司_博辰仓","enable":"1","level":"1","is_leaf":true,"parent_id":"100000","parent_name":"惠州市银嘉环保科技有限公司","parent_number":"100000"}', N'成功', NULL, N'bs_dept', N'BM00019', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.253', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-004' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018004, N'IMP-20261018-004', 5, N'BM00014', N'{"id":"2173486575915155456","number":"BM00014","name":"材料研发实验室1","long_number":"100000!BM00014","full_name":"惠州市银嘉环保科技有限公司_材料研发实验室1","enable":"1","level":"1","is_leaf":true,"parent_id":"100000","parent_name":"惠州市银嘉环保科技有限公司","parent_number":"100000"}', N'成功', NULL, N'bs_dept', N'BM00014', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.257', NULL, NULL);

    -- IMP-20261018-005 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-005' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018005, N'IMP-20261018-005', 1, N'ZY00099', N'{"id":"2178314889490196480","number":"ZY00099","name":"LGH","mobile":"AYJxA+7VGUjwPZWcsbH3BA==","id_number":"","enable":"1"}', N'成功', NULL, N'bs_emp', N'ZY00099', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.260', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-005' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018005, N'IMP-20261018-005', 2, N'ZY00059', N'{"id":"2213772777486386176","number":"ZY00059","name":"白兴发","mobile":"","id_number":"","enable":"1"}', N'成功', NULL, N'bs_emp', N'ZY00059', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.260', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-005' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018005, N'IMP-20261018-005', 3, N'ZY00111', N'{"id":"2488035518470834176","number":"ZY00111","name":"白自学","mobile":"","id_number":"","enable":"1"}', N'成功', NULL, N'bs_emp', N'ZY00111', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.263', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-005' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018005, N'IMP-20261018-005', 4, N'ZY00036', N'{"id":"2199311286494390308","number":"ZY00036","name":"曹飞平","mobile":"","id_number":"","enable":"1"}', N'成功', NULL, N'bs_emp', N'ZY00036', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.263', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-005' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018005, N'IMP-20261018-005', 5, N'ZY00106', N'{"id":"2468475164099204096","number":"ZY00106","name":"曾小玲","mobile":"","id_number":"","enable":"1"}', N'成功', NULL, N'bs_emp', N'ZY00106', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.267', NULL, NULL);

    -- IMP-20261018-006 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-006' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018006, N'IMP-20261018-006', 1, N'A-26', N'{"id":"2157960004865371136","name":"广州市鑫万电子商务有限公司","number":"A-26","group_name":"直管客户","c_level_id":"","remark":"","enable":"1"}', N'成功', NULL, N'bs_kh', N'A-26', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.270', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-006' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018006, N'IMP-20261018-006', 2, N'A-28', N'{"id":"2157964422558002176","name":"深圳市华企倍力科技有限公司","number":"A-28","group_name":"直管客户","c_level_id":"","remark":"","enable":"1"}', N'成功', NULL, N'bs_kh', N'A-28', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.270', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-006' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018006, N'IMP-20261018-006', 3, N'A-32', N'{"id":"2157417613142120448","name":"绍兴摩纳净水科技有限公司","number":"A-32","group_name":"直管客户","c_level_id":"","remark":"","enable":"1"}', N'成功', NULL, N'bs_kh', N'A-32', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.270', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-006' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018006, N'IMP-20261018-006', 4, N'A-33', N'{"id":"2157964406837840896","name":"佛山顺德区苏格伦电器有限公司","number":"A-33","group_name":"直管客户","c_level_id":"","remark":"","enable":"1"}', N'成功', NULL, N'bs_kh', N'A-33', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.273', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-006' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018006, N'IMP-20261018-006', 5, N'A-34', N'{"id":"2157960005192616960","name":"广东酷尔科技有限公司","number":"A-34","group_name":"直管客户","c_level_id":"","remark":"","enable":"1"}', N'成功', NULL, N'bs_kh', N'A-34', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.277', NULL, NULL);

    -- IMP-20261018-007 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-007' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018007, N'IMP-20261018-007', 1, N'GYS00014', N'{"id":"2241285519952694272","number":"GYS00014","name":"KG","group_id":"","group_name":"","group_number":"","rate":"0","bank":"","bank_account":"","account_open_addr":"","invoice_name":"","taxpayer_no":"","bom_entity":[],"remark":""}', N'成功', NULL, N'bs_gf', N'GYS00014', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.280', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-007' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018007, N'IMP-20261018-007', 2, N'GYS00008', N'{"id":"2223498443005978624","number":"GYS00008","name":"TBRW","group_id":"","group_name":"","group_number":"","rate":"0","bank":"","bank_account":"","account_open_addr":"","invoice_name":"","taxpayer_no":"","bom_entity":[],"remark":""}', N'成功', NULL, N'bs_gf', N'GYS00008', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.280', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-007' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018007, N'IMP-20261018-007', 3, N'GYS00004', N'{"id":"2195077099428005888","number":"GYS00004","name":"xxx供应商2","group_id":"2195028432465703936","group_name":"配件","group_number":"GYSFL00001","rate":"0","bank":"","bank_account":"","account_open_addr":"","invoice_name":"","taxpayer_no":"","bom_entity":[],"remark":""}', N'成功', NULL, N'bs_gf', N'GYS00004', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.280', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-007' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018007, N'IMP-20261018-007', 4, N'GYS00003', N'{"id":"2195028619917537280","number":"GYS00003","name":"xx配件","group_id":"2195028432465703936","group_name":"配件","group_number":"GYSFL00001","rate":"0","bank":"","bank_account":"","account_open_addr":"","invoice_name":"","taxpayer_no":"","bom_entity":[],"remark":""}', N'成功', NULL, N'bs_gf', N'GYS00003', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.283', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-007' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018007, N'IMP-20261018-007', 5, N'GYS00013', N'{"id":"2233370916933427200","number":"GYS00013","name":"YJ","group_id":"","group_name":"","group_number":"","rate":"0","bank":"","bank_account":"","account_open_addr":"","invoice_name":"","taxpayer_no":"","bom_entity":[],"remark":""}', N'成功', NULL, N'bs_gf', N'GYS00013', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.283', NULL, NULL);

    -- IMP-20261018-008 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-008' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018008, N'IMP-20261018-008', 1, N'YJ-20261018-01', N'{"create_time":"2026-10-18 09:39:15","bill_date":"2026-10-18","id":"2592814578081603584","bill_no":"YJ-20261018-01","bill_status":"Z","bill_close_state":"C","supplier_id":"2259644883130231808","supplier_name":"昆山市万件光芒五金机电有限公司","supplier_number":"YJ-WJGM","emp_id":"2157416748628955136","emp_name":"孙淼淼","emp_number":"GD","remark":"","io_status":"A","real_io_status":"A","delivery_type_id":"","delivery_type_name":"","delivery_type_number":""}', N'成功', NULL, N'bd_pu_order', N'YJ-20261018-01', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.287', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-008' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018008, N'IMP-20261018-008', 2, N'YJ-20261017-06', N'{"create_time":"2026-10-17 18:16:47","bill_date":"2026-10-17","id":"2592373991025012736","bill_no":"YJ-20261017-06","bill_status":"Z","bill_close_state":"C","supplier_id":"2158089909380942848","supplier_name":"深圳市金品隆科技有限公司","supplier_number":"YJ-JPL","emp_id":"2183434422324416512","emp_name":"王光珍","emp_number":"ZY00018","remark":"","io_status":"A","real_io_status":"A","delivery_type_id":"","delivery_type_name":"","delivery_type_number":""}', N'成功', NULL, N'bd_pu_order', N'YJ-20261017-06', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.290', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-008' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018008, N'IMP-20261018-008', 3, N'YJ-20261017-05', N'{"create_time":"2026-10-17 18:11:24","bill_date":"2026-10-17","id":"2592347940655867904","bill_no":"YJ-20261017-05","bill_status":"Z","bill_close_state":"C","supplier_id":"2183324673494761472","supplier_name":"东莞市真炙包装材料有限公司","supplier_number":"YJ-ZZ","emp_id":"2183434422324416512","emp_name":"王光珍","emp_number":"ZY00018","remark":"","io_status":"A","real_io_status":"A","delivery_type_id":"","delivery_type_name":"","delivery_type_number":""}', N'成功', NULL, N'bd_pu_order', N'YJ-20261017-05', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.290', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-008' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018008, N'IMP-20261018-008', 4, N'YJ-20261017-04', N'{"create_time":"2026-10-17 16:21:47","bill_date":"2026-10-17","id":"2592292442405465088","bill_no":"YJ-20261017-04","bill_status":"Z","bill_close_state":"C","supplier_id":"2158089909540236288","supplier_name":"深圳市陶氏水处理设备技术开发有限公司","supplier_number":"YJ-TS","emp_id":"2183434422324416512","emp_name":"王光珍","emp_number":"ZY00018","remark":"","io_status":"A","real_io_status":"A","delivery_type_id":"","delivery_type_name":"","delivery_type_number":""}', N'成功', NULL, N'bd_pu_order', N'YJ-20261017-04', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.293', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-008' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018008, N'IMP-20261018-008', 5, N'YJ-20261017-03', N'{"create_time":"2026-10-17 15:07:00","bill_date":"2026-10-17","id":"2592258268717938688","bill_no":"YJ-20261017-03","bill_status":"Z","bill_close_state":"C","supplier_id":"2158089913248091136","supplier_name":"佛山市云创壹芯新材料有限公司","supplier_number":"YJ-YCYX","emp_id":"2183434422324416512","emp_name":"王光珍","emp_number":"ZY00018","remark":"","io_status":"A","real_io_status":"A","delivery_type_id":"","delivery_type_name":"","delivery_type_number":""}', N'成功', NULL, N'bd_pu_order', N'YJ-20261017-03', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.293', NULL, NULL);

    -- IMP-20261018-009 明细 5 行
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-009' AND [行号] = 1)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018009, N'IMP-20261018-009', 1, N'ZXL-20261017-03', N'{"bill_dis_amount":"0","create_time":"2026-10-17 18:02:19","bill_date":"2026-10-17","id":"2592343092434694144","bill_no":"ZXL-20261017-03","bill_status":"Z","settle_status":"A","delivery_type":"","customer_id":"2157959977795333120","customer_name":"深圳市福瑞兴科技有限公司","customer_number":"D-02","emp_id":"2157416379672782848","emp_name":"邹新龙","emp_number":"ZXL","total_amount":"17550","material_group":"","material_qty":"","bill_dis_before_amount":"","real_io_status":"A","io_status":"A","bill_close_state":"C","custom_field":{"custom_field__1__4ujia65gxej1x1":""},"dept_id":"2157415425770612736","dept_name":"销售部","dept_number":"BM00001","audit_date":""}', N'成功', NULL, N'bd_so_order', N'ZXL-20261017-03', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.300', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-009' AND [行号] = 2)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018009, N'IMP-20261018-009', 2, N'ZXL-20261017-02', N'{"bill_dis_amount":"0","create_time":"2026-10-17 17:59:00","bill_date":"2026-10-17","id":"2592342740037656576","bill_no":"ZXL-20261017-02","bill_status":"Z","settle_status":"A","delivery_type":"","customer_id":"2157959983247928320","customer_name":"创鸿鑫","customer_number":"D-37","emp_id":"2157416379672782848","emp_name":"邹新龙","emp_number":"ZXL","total_amount":"1854.4","material_group":"","material_qty":"","bill_dis_before_amount":"","real_io_status":"A","io_status":"A","bill_close_state":"C","custom_field":{"custom_field__1__4ujia65gxej1x1":""},"dept_id":"2157415425770612736","dept_name":"销售部","dept_number":"BM00001","audit_date":""}', N'成功', NULL, N'bd_so_order', N'ZXL-20261017-02', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.300', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-009' AND [行号] = 3)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018009, N'IMP-20261018-009', 3, N'ZXL-20261017-01', N'{"bill_dis_amount":"0","create_time":"2026-10-17 10:55:33","bill_date":"2026-10-17","id":"2592128699889355776","bill_no":"ZXL-20261017-01","bill_status":"C","settle_status":"A","delivery_type":"","customer_id":"2157959985454222336","customer_name":"彩向（惠州市）塑胶模具有限公司","customer_number":"D-51","emp_id":"2157416379672782848","emp_name":"邹新龙","emp_number":"ZXL","total_amount":"6669","material_group":"","material_qty":"","bill_dis_before_amount":"","real_io_status":"A","io_status":"A","bill_close_state":"C","custom_field":{"custom_field__1__4ujia65gxej1x1":""},"dept_id":"2157415425770612736","dept_name":"销售部","dept_number":"BM00001","audit_date":"2026-10-17 11:58:01"}', N'成功', NULL, N'bd_so_order', N'ZXL-20261017-01', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.300', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-009' AND [行号] = 4)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018009, N'IMP-20261018-009', 4, N'ZL-20261017-03', N'{"bill_dis_amount":"0","create_time":"2026-10-17 17:26:00","bill_date":"2026-10-17","id":"2592325750606531584","bill_no":"ZL-20261017-03","bill_status":"Z","settle_status":"A","delivery_type":"","customer_id":"2157964406669978624","customer_name":"青岛伊可普电器有限公司","customer_number":"C-95","emp_id":"2157416879046617088","emp_name":"张莉","emp_number":"ZL","total_amount":"406604","material_group":"","material_qty":"","bill_dis_before_amount":"","real_io_status":"A","io_status":"A","bill_close_state":"C","custom_field":{"custom_field__1__4ujia65gxej1x1":""},"dept_id":"2157415425770612736","dept_name":"销售部","dept_number":"BM00001","audit_date":""}', N'成功', NULL, N'bd_so_order', N'ZL-20261017-03', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.303', NULL, NULL);
    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'IMP-20261018-009' AND [行号] = 5)
        INSERT INTO dbo.erp_imp_row ([批次id], [批次号], [行号], [源单号], [原始JSON], [解析状态], [错误信息], [目标表], [目标键], [处理状态], [asp_cancel], [asp_user1], [asp_time1], [asp_user2], [asp_time2])
        VALUES (@b20261018009, N'IMP-20261018-009', 5, N'ZL-20261017-02', N'{"bill_dis_amount":"0","create_time":"2026-10-17 15:16:09","bill_date":"2026-10-17","id":"2592259132350390272","bill_no":"ZL-20261017-02","bill_status":"C","settle_status":"A","delivery_type":"","customer_id":"2157964404220595200","customer_name":"宁波市碧纯科技有限公司","customer_number":"C-78","emp_id":"2157416879046617088","emp_name":"张莉","emp_number":"ZL","total_amount":"19258.2","material_group":"","material_qty":"","bill_dis_before_amount":"","real_io_status":"A","io_status":"A","bill_close_state":"C","custom_field":{"custom_field__1__4ujia65gxej1x1":""},"dept_id":"2157415425770612736","dept_name":"销售部","dept_number":"BM00001","audit_date":"2026-10-17 18:54:13"}', N'成功', NULL, N'bd_so_order', N'ZL-20261017-02', N'已写入', N'N', N'金蝶同步', '2026-10-18 09:58:47.303', NULL, NULL);

    /* ── 自检:期望 log=9 / row=45 ── */
    DECLARE @logN INT = (SELECT COUNT(*) FROM dbo.erp_imp_log WHERE [批次号] LIKE 'IMP-20261018-%');
    DECLARE @rowN INT = (SELECT COUNT(*) FROM dbo.erp_imp_row WHERE [批次号] LIKE 'IMP-20261018-%');
    RAISERROR('RESULT: ERPLG-PUSH log=%d row=%d (expect 9 / 45)', 10, 1, @logN, @rowN) WITH NOWAIT;
END
ELSE
    RAISERROR('RESULT: ERPLG-PUSH SKIPPED (erp_imp_log / erp_imp_row not found)', 10, 1) WITH NOWAIT;
