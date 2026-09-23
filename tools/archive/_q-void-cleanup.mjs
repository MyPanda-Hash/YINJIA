/** 一次性收尾:按 panel:no 逐个 弃审 → 删除(探针中途异常时清理残留草稿单) */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const cb = async (panel, buttonName, no) => {
  const j = await (await fetch(API + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName, formData: { 编号: no }, buttonParam: {} }) })).json();
  return j.code === 0 || j.code === 200 ? '✓' : '✗' + String(j.message || '').slice(0, 70);
};
for (const arg of process.argv.slice(2)) {
  const [panel, no] = arg.split(':');
  const a = await cb(panel, '弃审', no);
  const b = await cb(panel, '删除', no);
  console.log(`${panel} ${no}  弃审=${a}  删除=${b}`);
}
