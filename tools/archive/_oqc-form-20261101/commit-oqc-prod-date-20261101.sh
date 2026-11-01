#!/usr/bin/env bash
# commit-oqc-prod-date-20261101.sh —— 生产日期随生产批次带入(2026-11-01 下午)
set -e
cd /d/workspace/yinjia

echo '===== 1/3 生产日期随生产批次带入(生成 + 存量回填) ====='
git add \
  backend/src/main/java/com/yinjia/mes/service/OqcReportService.java \
  tools/migrate-oqc-prod-date-20261101.sql \
  tools/db-migrations.txt
git commit -m "fix: 出厂检验报告生产日期随生产批次带入(不再固定留空)" \
  -m "用户报障(2026-11-01 下午):「当前如果是带入了批次号为什么连生产日期都没有呢？」根因两层:① OqcReportService.createOne 把 生产日期 固定写 NULL(2026-10-30 设计口径「业务未录→留空」);② 取数来源成品检验单 qc_asm_insp_head 没有生产日期列(只有检验日期),首件检验单的 生产日期 当时没取 ⇒ 批次号(出库行批号)带进来了、生产日期一直空。" \
  -m "新生成:OqcReportService.resolveProductionDate() 按 ①工单行完工时间 plang.完工时间(批次号=完工日标签,实测 20261017 ↔ 2026-10-17) → ②批次号可解析 yyyyMMdd → ③首件检验单生产日期(同工单行)兜底 → ④取不到留空 写入。" \
  -m "存量:tools/migrate-oqc-prod-date-20261101.sql 同口径回填(只填 IS NULL);内含「首版顺序更正」段(只更正 当前值=首件日 且≠批次日 的行,不覆盖人工填写);生产日期 列补 MS_Description 说明来源;已登记 db-migrations.txt,两账套均执行(执行 1 / 失败 0)。" \
  -m "踩坑:两账套 compatibility_level=100(兼容 SQL Server 2008)⇒ 无 TRY_CONVERT,改用 ISDATE()+CONVERT(date,…,23);测试账套旧快照 plang 无该工单行 ⇒ 自动落批次号解析,结果一致 2026-10-17。" \
  -m "验证:测试账套 OQC-2026-11-0003 生产日期=2026-10-17;新生成 OQC-2026-11-0014 生产日期=2026-10-17(演练后已清理);纸面生产日期格已显示。"

echo '===== 2/3 文档 ====='
git add docs/design/出厂检验报告-从三张检验单并集生成.md
git commit -m "docs: 出厂检验报告生产日期补正(根因/取值口径/验证/踩坑)" \
  -m "《出厂检验报告-从三张检验单并集生成》新增 §21:现象与两层根因(固定写 NULL + 成品检验单无生产日期列)、四段取值口径(工单行完工时间→批次号→首件日→空)、落地(生成+存量回填+列注明)、验证、踩坑(compat 100 无 TRY_CONVERT / 测试账套旧快照 / 首版顺序错误与更正)。"

echo '===== 3/3 取证留档 ====='
git add tools/archive/_oqc-form-20261101
git commit -m "chore: 出厂检验报告生产日期取证留档" \
  -m "e2e-proddate.mjs(生成→回读生产日期→0003 回填校验→纸面截图)、README §12.4(本轮修复与踩坑)。"

echo '===== 结果 ====='
git log --oneline -5
echo '--- 本任务文件状态(应空) ---'
git status --porcelain tools/migrate-oqc-prod-date-20261101.sql tools/db-migrations.txt backend/src/main/java/com/yinjia/mes/service/OqcReportService.java docs/design/出厂检验报告-从三张检验单并集生成.md tools/archive/_oqc-form-20261101 backend/src/main/resources/static | grep -v "\.png$" | head
