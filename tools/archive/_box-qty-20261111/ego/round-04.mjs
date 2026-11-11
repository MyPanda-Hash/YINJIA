// round-04:直接打接口,看弹窗取数是否正常(rows 为什么是 0)
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const res = await page.fetch("/api/px/puLabel/dialog?orderNo=YJ-20261013-01", { timeout: 20000 }).catch((e) => ({ err: String(e && e.message) }));
if (res.err) { console.log("fetch err:", res.err); }
else {
  console.log("status:", res.status);
  let body = res.body;
  try { body = JSON.parse(res.body); } catch (e) {}
  const data = body && body.data ? body.data : body;
  console.log(JSON.stringify({
    code: body && body.code,
    msg: body && body.msg,
    lines: (data && data.lines || []).length,
    firstLine: (data && data.lines || [])[0],
    prefBatchNo: data && data.prefBatchNo,
    records: (data && data.records || []).length,
  }, null, 2));
}
