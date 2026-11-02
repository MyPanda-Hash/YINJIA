#!/usr/bin/env bash
# commit-oqc-hygiene-blank-20261101.sh —— 卫生安全结果格「空白即可」补正提交(2026-11-01 09:24)
set -e
cd /d/workspace/yinjia

echo '===== 1/3 补正:结果格去掉「填写」占位文字 ====='
git add \
  frontend/src/core/qc/QcOqcSheet.vue \
  frontend/src/i18n/locales/en.js \
  docs/design/出厂检验报告-从三张检验单并集生成.md \
  tools/archive/_oqc-form-20261101
git commit -m "fix: 卫生安全结果格改为空白(不再显示「填写」占位文字)" \
  -m "用户口径(2026-11-01 09:24,截图圈住 15 个结果格):「空白的就可以」⇒ QcOqcSheet 卫生安全「结果」列的输入框去掉 :placeholder;未填时就是空白格,与纸质表单一致。en.js 删除随之无用的「填写」词条。保存/清空/打印/导出报表逻辑不变。" \
  -m "留档:e2e-hygiene-blank-shot.mjs + e2e-hygiene-blank.png(15 格 placeholder=null、值为空),README §11.3 记录本次补正。"

echo '===== 2/3 前端静态产物同步 ====='
git add backend/src/main/resources/static
git commit -m "chore: 前端静态产物同步(卫生安全结果格空白)" \
  -m "npm run build + dist 镜像同步到 backend/src/main/resources/static;apply-frontend-only 换入 8090 现役 jar 并探活通过(入口 chunk assets/index-Bfmn8qRa.js)。"

echo '===== 结果 ====='
git log --oneline -4
echo '--- 本任务文件状态(应空) ---'
git status --porcelain frontend/src/core/qc/QcOqcSheet.vue frontend/src/i18n/locales/en.js docs/design/出厂检验报告-从三张检验单并集生成.md tools/archive/_oqc-form-20261101 backend/src/main/resources/static | grep -v "\.png$" | head
