#!/usr/bin/env bash
# commit-oqc-sheet-20261101.sh —— 出厂检验报告「纸张式面板」第三轮提交(2026-11-01)
# 只 add 本任务文件;工作区其它未提交改动/删除一概不碰。
set -e
cd /d/workspace/yinjia

echo '===== 1/4 纸张式面板(组件 + 接线 + 直审 + 资产/i18n + 后端死配置删除) ====='
git add \
  frontend/src/core/qc/QcOqcSheet.vue \
  frontend/src/core/views/PanelxList.vue \
  frontend/src/i18n/locales/en.js \
  frontend/src/assets/logo_agplus.jpg \
  backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java
git commit -m "feat: 出厂检验报告面板改为首件检验单同款纸张式受控记录表" \
  -m "用户口径(2026-11-01 07:28):「我是说当前的出厂检验报告实现当前和首件检验单相同的形式,能实现这个出厂检验报告实现而不是这种表格页面了」⇒ 面板页由「表头字段条 + 17 列明细表格」的数据页改成 QB_FIRST_INSP 同形态:整页 A4 受控表单纸居中 + 左侧单据选择栏 + 右侧按钮竖栏,纸上直接填。" \
  -m "新增 frontend/src/core/qc/QcOqcSheet.vue(774 行,写法照 QcFirstInspSheet.vue):纸头 logo/公司名/横线 + 标题/编制日期 + 抬头 9 格(7 项草稿可填)+ 主表 7 列(序号只读、其余可填、多行自动撑高)+ 检验结论/备注(同表 colspan 对齐)+ 卫生安全 15 行(结果只读「见型式检验报告」)+ 签署行 + YJ-QR-05/A1 + 页脚;含打印白名单 CSS(approval-printing、A4 2 页、行/表尾不拆页、清灰底、隐藏控件)。" \
  -m "PanelxList 接线:isApprovalDoc += QC_OQC_REPORT;挂载组件;DOC_RAIL_PANELS 左栏(单号|日期|客户名称|产品名称|审核状态);两处纸张选择器加 .oqc-sheet;「导出」弹窗 PDF/预览/Excel 对 OQC 改走服务端受控表单报表(不截图,避免 15 行被压成一页);删除上一轮 printOqcReport 死代码。DIRECT_AUDIT_PANELS += QC_OQC_REPORT(管理员直审「审核/弃审」,与首件/制程同口径;后端 ButtonService.audit 通用,无需改后端)。" \
  -m "PanelConfigService 删除上一轮给 QC_OQC_REPORT 加的「打印|预览」工具栏组(approval 布局工具栏整条不渲染=死配置且与侧栏打印重复)。新增 frontend/src/assets/logo_agplus.jpg;en.js 补 62 条纸面词条(业务数据不翻译)。"

echo '===== 2/4 前端静态产物同步 ====='
git add backend/src/main/resources/static
git commit -m "chore: 前端静态产物同步(出厂检验报告纸张式面板)" \
  -m "npm run build + dist 镜像同步到 backend/src/main/resources/static;8090 现役 jar 与该产物同源(apply-frontend-only 换入并探活通过)。"

echo '===== 3/4 文档 ====='
git add docs/design/出厂检验报告-从三张检验单并集生成.md
git commit -m "docs: 出厂检验报告第三轮落地(面板纸张式 + 管理员直审)" \
  -m "《出厂检验报告-从三张检验单并集生成》新增 §17:用户口径、纸张组件结构与接线、打印/导出口径、直审口径、端到端验证(生成→跳转→编辑落库→打印 2 页→导出报表预览→只读态→en)与本轮新增差异(第 2 页无 logo 页眉/DOM 打印 vs 服务端件、直审仅管理员);§16.2 打印行标注已被 §17 取代。"

echo '===== 4/4 取证与验证留档 ====='
git add tools/archive/_oqc-form-20261101
git commit -m "chore: 出厂检验报告纸张式面板取证与验证留档" \
  -m "QcOqcSheet 屏幕/英文/打印/只读态渲染件(oqc-sheet-*)、CDP printToPDF 工具、纸张面板 E2E(e2e-sheet-full.mjs 生成→编辑保存→打印→导出预览;e2e-final.mjs 干净单/英文/直审只读)、README §10(第三轮交付与复跑命令)。"

echo '===== 结果 ====='
git log --oneline -6
echo '--- 本任务文件是否已全部入库(应为空) ---'
git status --porcelain frontend/src/core/qc/QcOqcSheet.vue frontend/src/core/views/PanelxList.vue frontend/src/i18n/locales/en.js frontend/src/assets/ backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java backend/src/main/resources/static docs/design/出厂检验报告-从三张检验单并集生成.md tools/archive/_oqc-form-20261101 | head -10
