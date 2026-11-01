#!/usr/bin/env bash
# commit-oqc-anchor-20261101.sh —— 出厂检验报告「生产批次锚」第一步提交(2026-11-01 下午)
set -e
cd /d/workspace/yinjia

echo '===== 1/4 生产批次锚(迁移 + 生成落库 + 左栏工单号) ====='
git add \
  tools/migrate-oqc-batch-anchor-20261101.sql \
  tools/db-migrations.txt \
  backend/src/main/java/com/yinjia/mes/service/OqcReportService.java \
  frontend/src/core/views/PanelxList.vue
git commit -m "feat: 出厂检验报告锚定生产工单批次(工单号+工单行号)" \
  -m "用户口径(2026-11-01 13:45,方案讨论之后):「只需要实现第一步即可，后面的不用自动生成和发送给客户这些都不用」⇒ 只做数据模型:把报告锚到「生产工单批次」;不做自动生成、不做发送客户/留痕/出库前校验。" \
  -m "DB(tools/migrate-oqc-batch-anchor-20261101.sql):qc_oqc_head 加 工单号(nvarchar 50) + 工单行号(int)(批次号列已有)+ 两列 MS_Description 中文注明 + 普通索引 ix_qc_oqc_head_wo(工单号,工单行号)+ 历史回填(按 成品检验单号 → qc_asm_insp_head.工单号/工单行号)+ yj_field 登记(工单号 query,header 可见 / 工单行号 header 隐藏)+ en 译名 + 自检;已登记 db-migrations.txt,两账套均执行(执行 1 / 失败 0)。" \
  -m "为什么锚 工单号+工单行号:plang.批次号 是完工日日期标签(395 行仅 30 个值、27 个跨多工单),唯一身份是工单行;批次号列保留作显示/匹配辅助。本轮不加唯一索引:生成口径仍是出库行触发、一份=一个产品,同批次多行出库会各建一张,强加唯一键会让第二次生成报 DB 冲突;一工单行一份+复用属后续步骤。" \
  -m "OqcReportService.createOne:生成时把已解析到的 工单号/工单行号 一并 INSERT(此前只在内存里用于找首件/制程单);解析不到成品检验单时两列留空,不阻塞生成。" \
  -m "PanelxList.DOC_RAIL_PANELS:QC_OQC_REPORT 左栏中间列由 客户名称/产品名称 改为 工单号/产品名称(与首件/制程检验单同款),业务在报告列表一眼对上生产批次;客户名称仍由纸面抬头显示。"

echo '===== 2/4 前端静态产物同步 ====='
git add backend/src/main/resources/static
git commit -m "chore: 前端静态产物同步(出厂检验报告左栏显示工单号)" \
  -m "npm run build + dist 镜像同步到 backend/src/main/resources/static;rebuild-prod 打包并重启 8090 探活通过。"

echo '===== 3/4 文档 ====='
git add docs/design/出厂检验报告-从三张检验单并集生成.md
git commit -m "docs: 出厂检验报告「生产批次锚」第一步落地" \
  -m "《出厂检验报告-从三张检验单并集生成》新增 §20:用户口径(只做第一步)、落地内容(两列+索引+回填+生成写入+左栏工单号)、为什么不加唯一索引、两账套与实机验证(含新生成 OQC-2026-11-0013 的锚值)、已知边界(正式库历史报告无成品检验单号回填不到/未做自动生成与发送)。"

echo '===== 4/4 取证留档 ====='
git add tools/archive/_oqc-form-20261101
git commit -m "chore: 出厂检验报告生产批次锚取证留档" \
  -m "e2e-anchor.mjs(生成→回读工单号/工单行号→左栏列校验→截图)、stop-service-then-rebuild.ps1(并行会话占着 target jar 时先杀进程再立即 rebuild 的处置脚本)、README §12(本轮交付/验证/踩坑)。"

echo '===== 结果 ====='
git log --oneline -5
echo '--- 本任务文件状态(应空) ---'
git status --porcelain tools/migrate-oqc-batch-anchor-20261101.sql tools/db-migrations.txt backend/src/main/java/com/yinjia/mes/service/OqcReportService.java frontend/src/core/views/PanelxList.vue docs/design/出厂检验报告-从三张检验单并集生成.md tools/archive/_oqc-form-20261101 backend/src/main/resources/static | grep -v "\.png$" | head
