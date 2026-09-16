-- migrate-qc-recv-drop.sql — 暂收入库单 QC_RECV 下线(2026-09-15)
-- 用户口径:暂收入库单去除,相关内容一并删除。其表头角色(采购暂收)已由
-- 「库存核算·送料暂收单 SL_RECV」承接;来料检验单的选单来源已在代码侧切至 SL_RECV。
-- 删除范围:
--   1) 业务表 qc_recv / qc_recv_detail(现库为 3 张草稿测试单 ZS-2026-09-0001..0003,含明细)
--   2) yj_panel / yj_field 注册
--   3) 面板译名「暂收入库单」(en/ja)
--   4) 状态/占用/权限/附件行(防御性清理,当前均为 0)
-- 幂等: 可重复执行(全部 IF EXISTS / WHERE 判存)。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-qc-recv-drop.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i /tmp/migrate-qc-recv-drop.sql"
SET NOCOUNT ON;

-- ══════════ 1. 业务表(含数据:草稿测试单) ══════════
IF OBJECT_ID('qc_recv_detail') IS NOT NULL DROP TABLE qc_recv_detail;
IF OBJECT_ID('qc_recv') IS NOT NULL DROP TABLE qc_recv;
GO

-- ══════════ 2. 面板/字段注册 ══════════
DELETE FROM yj_field WHERE panel_code = 'QC_RECV';
DELETE FROM yj_panel WHERE panel_code = 'QC_RECV';
GO

-- ══════════ 3. 面板译名 ══════════
DELETE FROM yj_translation WHERE scope = 'panel' AND ref_key = N'暂收入库单';
GO

-- ══════════ 4. 状态/占用/权限/附件(防御性;当前 0 行) ══════════
DELETE FROM yj_doc_status WHERE panel_code = 'QC_RECV';
DELETE FROM form_flow_link WHERE source_panel_code = 'QC_RECV' OR target_panel_code = 'QC_RECV';
DELETE FROM yj_role_panel WHERE panel_code = 'QC_RECV';
DELETE FROM yj_attachment WHERE panel_code = 'QC_RECV';
DELETE FROM yj_form_approval WHERE panel_code = 'QC_RECV';
GO

-- ══════════ 5. 自检(应全为 0;table 不存在) ══════════
SELECT
  OBJECT_ID('qc_recv') AS qc_recv_table,
  OBJECT_ID('qc_recv_detail') AS qc_recv_detail_table,
  (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'QC_RECV') AS panel_rows,
  (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'QC_RECV') AS field_rows,
  (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'暂收入库单') AS panel_i18n,
  (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_RECV') AS status_rows,
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code = 'QC_RECV' OR target_panel_code = 'QC_RECV') AS link_rows;
PRINT N'migrate-qc-recv-drop 完成:暂收入库单下线(表+注册+译名+状态 全清;检验单选单来源已切 SL_RECV)';
GO
