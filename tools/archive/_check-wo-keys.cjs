/** 新增 UI 词条 en 覆盖检查 */
const fs = require('fs');
const en = fs.readFileSync('D:/workspace/yinjia/frontend/src/i18n/locales/en.js', 'utf8');
const keys = ['日期范围', '起', '止', '清空', '确认排产', '打印工单', '排产', '请先选择一张单据', '已发送打印',
  '生产任务单', '线体', '制单', '今日负荷', '日产能', '超载', '已排产', '排产失败', '请选择生产线',
  '高级筛选', '添加条件', '值', '字段', '序号'];
const miss = keys.filter((k) => !en.includes("'" + k + "'"));
console.log(miss.length ? '缺: ' + miss.join(' | ') : 'OK 全部已有 en 译名');
