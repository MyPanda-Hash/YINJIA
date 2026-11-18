const task = await taskSpace(52);
const page = task.page("p1");
const info = await page.evaluate(() => {
  const t = localStorage.getItem("mes_token") || "";
  const parts = t.split(".");
  let payload = "";
  try {
    const b = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    payload = decodeURIComponent(
      atob(b + "=".repeat((4 - (b.length % 4)) % 4))
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch (e) {
    payload = "decode-failed:" + e.message;
  }
  return { tokenLen: t.length, payload, factory: localStorage.getItem("mes_factory"), loginDate: localStorage.getItem("mes_login_date") };
});
console.log(JSON.stringify(info, null, 1));
