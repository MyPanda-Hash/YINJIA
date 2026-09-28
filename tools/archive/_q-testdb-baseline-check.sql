/* 探针:测试库上 migrate-spec-testlib-replace.sql 声明的对象是否已存在(决定可否 baseline) */
SELECT CASE WHEN OBJECT_ID('yj_spec_test') IS NOT NULL THEN N'yj_spec_test 存在' ELSE N'yj_spec_test 不存在!' END AS chk1,
       CASE WHEN OBJECT_ID('yj_std_lib') IS NOT NULL THEN N'yj_std_lib 存在' ELSE N'yj_std_lib 不存在!' END AS chk2;
SELECT COUNT(*) AS spec_test_lib_rows FROM yj_std_lib;
SELECT COUNT(*) AS ledger_rows FROM yj_field WHERE panel_code IN ('STOCK_LEDGER','STOCK_BALANCE') AND col_name IN (N'仓库',N'存货') AND ref_field IN (N'仓库编码',N'存货编码');
