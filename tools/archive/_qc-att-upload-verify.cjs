// _qc-att-upload-verify.cjs — 一次性:UTF-8 正确编码上传附件到 QC_INSP/IJ-2026-09-0001/附件1 并验证头列同步
const BASE = 'http://localhost:8090/api';
(async () => {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const token = login.data.token;
  const auth = { Authorization: 'Bearer ' + token };

  // 清掉之前 curl 发坏的 field_key='????1' 行(id=1)
  const del = await fetch(BASE + '/attachment/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ id: 1 }),
  }).then((r) => r.json());
  console.log('delete bad row:', del.code, del.message);

  const fd = new FormData();
  fd.append('file', new Blob(['QC-INSP attachment verify\n'], { type: 'text/plain' }), 'qc-att-test.txt');
  fd.append('panelCode', 'QC_INSP');
  fd.append('docNo', 'IJ-2026-09-0001');
  fd.append('field', '附件1');
  const up = await fetch(BASE + '/attachment/upload', { method: 'POST', headers: auth, body: fd }).then((r) => r.json());
  console.log('upload:', JSON.stringify(up));
})();
