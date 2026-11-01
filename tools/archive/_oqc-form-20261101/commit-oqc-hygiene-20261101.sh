#!/usr/bin/env bash
# commit-oqc-hygiene-20261101.sh —— 出厂检验报告「卫生安全 15 项结果可填写」第四轮提交(2026-11-01)
set -e
cd /d/workspace/yinjia

echo '===== 1/4 卫生安全结果可填写(迁移 + 纸面 + 报表 + 专用保存接口) ====='
git add \
  tools/migrate-oqc-hygiene-results-20261101.sql \
  tools/db-migrations.txt \
  backend/src/main/resources/reports/qc_oqc.jrxml \
  backend/src/main/resources/reports/report-templates.properties \
  backend/src/main/java/com/yinjia/mes/controller/OqcReportController.java \
  frontend/src/core/qc/QcOqcSheet.vue \
  frontend/src/core/views/PanelxList.vue \
  frontend/src/i18n/locales/en.js
git commit -m "feat: 出厂检验报告卫生安全 15 项结果改为可填写" \
  -m "用户口径(2026-11-01 08:42,截图红框圈住卫生安全表「结果」整列):「这些红框内容要能填写」⇒ 结果由静态「见型式检验报告」改为手填并落库;纸面直接填,打印/导出报表按填写值印出,空=留空(取代设计 Q5/Q8「本轮不录数」旧口径)。" \
  -m "DB:tools/migrate-oqc-hygiene-results-20261101.sql —— qc_oqc_head 加 15 个可空文本列 卫生_<项目> + 15 列中文注明 + yj_field 15 行(header/hidden,只作取数+保存+报表参数)+ 15 条 en 译名;已登记 db-migrations.txt,两账套均执行(执行 1/失败 0)。为什么不用行表:卫生安全是受控表单固定 15 项(每项一个结果格),与「一份报告=一个产品」头表语义一致;行表是动态检验项目。" \
  -m "纸面 QcOqcSheet:结果列草稿态 el-input(v-model 直绑 head[卫生_<项目>]、空 placeholder「填写」)、只读态显示值;打印 CSS 把输入框收到 10px、去控件外观(输入值照常打印)。" \
  -m "报表 qc_oqc.jrxml:15 个 \$P{卫生_<项目>} 参数,卫生安全结果列 staticText→textField(空→留空);report-templates.properties 注释同步。" \
  -m "OqcReportController 新增 POST /api/oqc/hygieneResults:15 列白名单显式写(空串→NULL)、只允许草稿态、需「保存」权限 —— 通用保存把空串归一成 null 并跳过(历史口径),单靠它「已填值改回空白」清不掉;PanelxList 在保存成功后(load 之前)对 QC_OQC_REPORT 调它补存 15 列。"

echo '===== 2/4 前端静态产物同步 ====='
git add backend/src/main/resources/static
git commit -m "chore: 前端静态产物同步(卫生安全结果可填写)" \
  -m "npm run build + dist 镜像同步到 backend/src/main/resources/static;8090 现役 jar 同源(rebuild-prod 打包并重启探活通过)。"

echo '===== 3/4 文档 ====='
git add docs/design/出厂检验报告-从三张检验单并集生成.md
git commit -m "docs: 出厂检验报告第四轮落地(卫生安全 15 项结果可填写)" \
  -m "《出厂检验报告-从三张检验单并集生成》新增 §18:用户口径、15 列/15 字段/专用保存接口的实现取舍、换包后端到端验证(填→存→回读、清空、DOM 打印、服务端报表 PDF、旧单留空、两账套执行)与已知差异(空值不再印「见型式检验报告」/项目名固定/表清单未刷新)。"

echo '===== 4/4 取证与验证留档 ====='
git add tools/archive/_oqc-form-20261101
git commit -m "chore: 出厂检验报告卫生安全结果取证留档" \
  -m "e2e-hygiene.mjs(填 15 项→保存→刷新回读→打印/报表 PDF→清空还原)、e2e-hygiene-shot.mjs(界面填写截图)、e2e-hygiene-print.pdf(DOM 打印 2 页)、e2e-hygiene-report.pdf(服务端 Jasper 2 页)、README §11(第四轮交付与复跑)。"

echo '===== 结果 ====='
git log --oneline -6
echo '--- 本任务文件是否已全部入库(应为空) ---'
git status --porcelain tools/migrate-oqc-hygiene-results-20261101.sql tools/db-migrations.txt backend/src/main/resources/reports/qc_oqc.jrxml backend/src/main/resources/reports/report-templates.properties backend/src/main/java/com/yinjia/mes/controller/OqcReportController.java frontend/src/core/qc/QcOqcSheet.vue frontend/src/core/views/PanelxList.vue frontend/src/i18n/locales/en.js backend/src/main/resources/static docs/design/出厂检验报告-从三张检验单并集生成.md tools/archive/_oqc-form-20261101 | grep -v "\.png$" | head
