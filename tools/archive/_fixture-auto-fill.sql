-- _fixture-auto-fill.sql — 一次性夹具:「自动填充规格书」端到端验证用的规格书数据
-- ⚠ 全部用 ZZFIX- 前缀,验证完用 tools/archive/_fixture-auto-fill-cleanup.sql 删干净。
-- 本机活库 rd_spec_doc_head/detail/assign 都是空的(见 _probe-insp-fields.out.txt),
-- 不造夹具就无法证明 /px/specByProduct 真的取到了数。
SET NOCOUNT ON;
DELETE FROM rd_spec_doc_detail WHERE 单据编号 = N'ZZFIX-SD-001';
DELETE FROM rd_spec_doc_head   WHERE 单据编号 = N'ZZFIX-SD-001';
DELETE FROM rd_spec_assign     WHERE 产品编号 = N'ZZFIX-P001';

INSERT INTO rd_spec_doc_head (单据编号, 单据日期, 名称, 编号, 客户名, 版本, 规格书种类,
                              整体规格参数, 客户项目名称, 产品类别, asp_user1, asp_time1)
VALUES (N'ZZFIX-SD-001', N'2026-09-20', N'伊可普炭棒规格书', N'ZZFIX-P001', N'伊可普', N'V1.0', N'出货检验',
        N'外径46±0.5mm / 内径9.5±0.5mm / 长度23±0.5mm', N'伊可普除VOC项目', N'碱性炭棒', N'夹具', SYSDATETIME());

INSERT INTO rd_spec_doc_detail (单据编号, 表区, 序号, 检验项目, 检验要求, 检验方法, 检验依据, asp_user1, asp_time1)
VALUES
 (N'ZZFIX-SD-001', N'检验要求', N'1', N'*外观',       N'清洁、无破损无压痕，无裂纹', N'目视',     N'Q/YJ 001', N'夹具', SYSDATETIME()),
 (N'ZZFIX-SD-001', N'检验要求', N'2', N'*出货重量',   N'>22g',                        N'电子秤',   N'Q/YJ 001', N'夹具', SYSDATETIME()),
 (N'ZZFIX-SD-001', N'检验要求', N'3', N'*压降测试',   N'≤25kpa',                      N'数显压力表', N'Q/YJ 001', N'夹具', SYSDATETIME()),
 -- 干扰行:别的表区不该被自动填充带进来
 (N'ZZFIX-SD-001', N'修订记录',  N'9', N'',           N'',                            N'',         N'',          N'夹具', SYSDATETIME());
