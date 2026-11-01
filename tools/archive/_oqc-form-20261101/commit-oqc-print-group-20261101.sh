#!/usr/bin/env bash
# commit-oqc-print-group-20261101.sh —— 销售出库「生成出厂检验报告」并入「打印」下拉(2026-11-01 09:46)
set -e
cd /d/workspace/yinjia

git add \
  backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java \
  docs/design/出厂检验报告-从三张检验单并集生成.md \
  tools/archive/_oqc-form-20261101
git commit -m "feat: 销售出库「生成出厂检验报告」并入「打印」下拉，不再单独占一格" \
  -m "用户口径(2026-11-01 09:46,截图圈住销售出库工具栏上独立的「生成出厂检验报告」)：「把销售出库单里这个改到当前的打印按钮里面」。" \
  -m "PanelConfigService(PANDA 分支,SALE_OUT 专用):原来「遇到打印组前先插一个独立组」改为把动作追加进打印组 —— 主按钮仍是「打印」,下拉 = 预览 / 导出 / 生成出厂检验报告;panda 数组口径 {组名,动作1,动作2,…} ⇒ actions 取 subList(1) 再追加(动作1 与组名同名「打印」)。def.code() 守卫保证其它面板下发面 0 变化。" \
  -m "前端零改动:下拉项走 onGroupAction→onButton,现有 openOqcPicker 分支照常生效;isDisabled 里「生成出厂检验报告」登记不变(有当前单据即可点)。" \
  -m "验证:GET /api/px/getPanelConfig?panelCode=SALE_OUT → 打印组 actions=[打印,预览,导出,生成出厂检验报告]、无独立组;CDP 实测打印▼下拉=预览/导出/生成出厂检验报告,点击打开勾选弹窗(2 行);留档 e2e-print-group.mjs + README §11.4。" \
  -m "仅后端 jar 变更(-SkipFrontend 重打包重启 8090 探活通过),static 无变化。"

echo '===== 结果 ====='
git log --oneline -3
echo '--- 本任务文件状态(应空) ---'
git status --porcelain backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java docs/design/出厂检验报告-从三张检验单并集生成.md tools/archive/_oqc-form-20261101 backend/src/main/resources/static | grep -v "\.png$" | head
