#!/usr/bin/env bash
# commit-oqc-20261101.sh —— 出厂检验报告(版式+销售出库入口) 单任务分批提交(2026-11-01)
# 只 add 本任务文件;工作区里其它未提交改动/删除一概不碰。
set -e
cd /d/workspace/yinjia

echo '===== 1/5 版式(qc_oqc.jrxml + logo + 注册表) ====='
git add \
  backend/src/main/resources/reports/qc_oqc.jrxml \
  backend/src/main/resources/reports/logo_agplus.jpg \
  backend/src/main/resources/reports/report-templates.properties
git commit -m "feat: 出厂检验报告改用受控表单表格版式(c-95-12 / YJ-QR-05/A1)" \
  -m "用户口径(2026-11-01):「这个当前的出厂检验报告需要修改为图中所示的表格形式」。此前面板 QC_OQC_REPORT 没有专用模板,导出走通用兜底(字段流水 5 页),与受控表单完全不是一回事。" \
  -m "新增 reports/qc_oqc.jrxml(357 行):首页 logo+公司名/标题/编制日期 + 抬头 9 格 + 主表 7 列(序号|检验项目|检验要求|抽样标准|抽检量|结果|判定,数据行来自明细,长文本 StretchHeight 撑高、整行不跨页拆)+ 检验结论/备注 + 卫生安全 15 项(结果列本轮不录数,统一印「见型式检验报告」)+ 签署行 + YJ-QR-05/A1 + 页脚;第 2 页起 pageHeader 重复 logo 页眉。" \
  -m "新增 reports/logo_agplus.jpg(classpath 资源,onErrorType=Blank 兜底);report-templates.properties 登记 qc_oqc → QC_OQC_REPORT。DB 无同 code 行 ⇒ 走注册表,无需迁移。"

echo '===== 2/5 入口 + 打印 + generate 异常提示 ====='
git add \
  backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java \
  backend/src/main/java/com/yinjia/mes/controller/OqcReportController.java \
  frontend/src/core/views/PanelxList.vue \
  frontend/src/i18n/locales/en.js
git commit -m "feat: 销售出库勾选生成出厂检验报告并跳转报告页操作" \
  -m "用户口径(2026-11-01):「同时当前实现方式不改变,让当前勾选对应的销售出库单时候能转跳到当前这个出厂检验报告来进行操作这种实现我感觉会好一点」⇒ 2026-10-30 的生成逻辑(OqcReportService,三单并集取数/一份报告=一个产品)一字不动,只补入口与跳转。" \
  -m "后端 PanelConfigService:仅对 SALE_OUT 增独立按钮组「生成出厂检验报告」(转ERP→打印之间),def.code() 守卫保证其余面板下发面 0 变化;另给 QC_OQC_REPORT 补「打印|预览」组(该面板无 PANDA 基准、默认没有打印)。" \
  -m "前端 PanelxList:勾选弹窗(/api/oqc/preview:默认勾标准行数>0、=0 置灰并提示、批次不可用标黄)→ /api/oqc/generate → 提示单号 → tabs/路由跳到 QC_OQC_REPORT 并用 ?docNo= 打开第一张;isDisabled 显式登记(草稿单也可生成);QC_OQC_REPORT 的打印/预览改为打开服务端受控表单 PDF,不再 window.print() 屏幕 17 列宽表。en.js 补 10 条词条。" \
  -m "修 OqcReportController.generate 的 500 rollback:去掉方法上的 @Transactional(事务边界在 Service)。此前双层事务下 Service 抛 IllegalArgumentException ⇒ 内层 rollback-only、外层 UnexpectedRollbackException,前端拿到「服务异常:Transaction rolled back…」而非 400 中文原因(实测复现并验证修复:不存在出库单 → {code:400,message:销售出库单不存在:…})。"

echo '===== 3/5 前端静态产物同步 ====='
git add backend/src/main/resources/static
git commit -m "chore: 前端静态产物同步(出厂检验报告入口 + 打印走受控表单)" \
  -m "npm run build + dist 镜像同步到 backend/src/main/resources/static(部署包的前端来源),与 8090 现役 jar 内容同源(PanelxList chunk 同 hash)。"

echo '===== 4/5 文档 ====='
git add docs/design/出厂检验报告-从三张检验单并集生成.md
git commit -m "docs: 出厂检验报告第二批落地(受控表单版式 + 销售出库入口 + 端到端验证)" \
  -m "在《出厂检验报告-从三张检验单并集生成》补 §16:用户口径、交付件、版式结构/取数契约、端到端与模板级验证证据、已知前提与剩余差异(计划表只覆盖 2 个产品/续表头/卫生安全不录数/旧 prod_insp 样张模板待下架/重复生成不查重等)。"

echo '===== 5/5 取证与验证留档 ====='
git add tools/archive/_oqc-form-20261101
git commit -m "chore: 出厂检验报告取证与端到端验证留档" \
  -m "原件解析(source.doc/docx/pdf、docx_dump.txt)、模板填充验证器 FillQcOqc.java、渲染件与标单对照图、DB 探针与测试账套造数 SeedTest.java、API/UI/E2E 脚本与截图;README.md 含复跑命令与 Jasper 踩坑。"

echo '===== 结果 ====='
git log --oneline -6
echo '--- 本任务文件是否已全部入库 ---'
git status --porcelain backend/src/main/resources/reports/ backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java backend/src/main/java/com/yinjia/mes/controller/OqcReportController.java frontend/src/core/views/PanelxList.vue frontend/src/i18n/locales/en.js docs/design/出厂检验报告-从三张检验单并集生成.md tools/archive/_oqc-form-20261101 backend/src/main/resources/static | head -10
