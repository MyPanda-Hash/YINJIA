const fs = await import("node:fs/promises");
const OUT = "C:/Users/vigna/ego/qc-print-audit-20261116/";
await fs.mkdir(OUT, { recursive: true });
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
console.log("space=" + task.spaceId + " page=" + page.label);
async function login() {
  const st = await page.evaluate(() => ({ login: !!document.querySelector("input[type=password]"), hash: location.hash }));
  if (!st.login) return true;
  await page.evaluate(() => {
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const ins = [...document.querySelectorAll("input")];
    const acc = ins.find((i) => /账号|account/i.test(i.placeholder || "")) || ins.find((i) => i.type === "text" && String(i.className).includes("el-input__inner"));
    const pwd = document.querySelector("input[type=password]");
    if (acc) set(acc, "admin");
    if (pwd) set(pwd, "123456");
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /进入系统|Enter|Sign in|登录/.test(x.textContent || "")) || document.querySelector("button.login-submit"); if (b) b.click(); });
  await page.waitForTimeout(7000);
  return true;
}
const panels = [
  { code: "QC_FIRST_INSP", sheet: ".fi-sheet" },
  { code: "QC_PROC_INSP", sheet: ".qr-sheet" },
  { code: "QC_LINE_PATROL", sheet: ".lp-sheet" }
];
const out = [];
for (const p of panels) {
  await page.goto("http://127.0.0.1:8090/#/panelx/list/" + p.code, { timeout: 90000 });
  await page.waitForTimeout(6500);
  await login();
  await page.goto("http://127.0.0.1:8090/#/panelx/list/" + p.code, { timeout: 90000 });
  await page.waitForTimeout(6500);
  let info = await page.evaluate((sel) => ({
    railRows: document.querySelectorAll(".doc-select-rail tbody tr").length,
    railText: (document.querySelector(".doc-select-rail")?.innerText || "").replace(/\s+/g, " ").slice(0, 260),
    sheet: !!document.querySelector(sel),
    inputs: document.querySelectorAll(sel + " input, " + sel + " textarea").length,
    side: [...document.querySelectorAll(".as-side-btn")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 20)
  }), p.sheet);
  if (info.sheet && info.inputs === 0 && info.railRows > 0) {
    await page.evaluate(() => { const r = document.querySelector(".doc-select-rail tbody tr"); if (r) r.click(); });
    await page.waitForTimeout(3500);
    info = await page.evaluate((sel) => ({
      railRows: document.querySelectorAll(".doc-select-rail tbody tr").length,
      railText: (document.querySelector(".doc-select-rail")?.innerText || "").replace(/\s+/g, " ").slice(0, 260),
      sheet: !!document.querySelector(sel),
      inputs: document.querySelectorAll(sel + " input, " + sel + " textarea").length,
      side: [...document.querySelectorAll(".as-side-btn")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 20)
    }), p.sheet);
  }
  await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++; }; });
  await page.evaluate(() => { const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "导出"); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const clicked = await page.evaluate(() => {
    const d = [...document.querySelectorAll(".el-dialog")].find((x) => x.offsetWidth);
    if (!d) return false;
    const hit = [...d.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "打印预览" && !e.children.length);
    if (!hit) return false;
    hit.click(); return true;
  });
  await page.waitForTimeout(7000);
  const host = await page.evaluate(() => {
    const h = document.getElementById("yj-print-host");
    const img = h ? h.querySelector("img") : null;
    return { host: !!h, printCalled: window.__printCalled, src: img ? img.src : "", w: img ? img.naturalWidth : 0, hgt: img ? img.naturalHeight : 0 };
  });
  if (host.src) {
    const small = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const w = 1000, h = Math.round((img.naturalHeight * w) / img.naturalWidth);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/jpeg", 0.88);
    }, host.src);
    await fs.writeFile(OUT + p.code + "-printpreview.jpg", Buffer.from(small.split(",")[1], "base64"));
  }
  await page.evaluate(() => { document.getElementById("yj-print-host")?.remove(); document.getElementById("yj-print-host-css")?.remove(); });
  await page.evaluate(() => { document.body.classList.add("approval-printing"); });
  await page.waitForTimeout(900);
  const printInfo = await page.evaluate((sel) => {
    const sheet = document.querySelector(sel);
    const cs = sheet ? getComputedStyle(sheet) : null;
    const np = [...document.querySelectorAll(sel + " .no-print")];
    return {
      noPrintCount: np.length,
      noPrintDisplay: [...new Set(np.map((e) => getComputedStyle(e).display))],
      fontFamily: cs ? cs.fontFamily : "",
      sheetW: sheet ? Math.round(sheet.getBoundingClientRect().width) : 0,
      sheetH: sheet ? Math.round(sheet.getBoundingClientRect().height) : 0,
      buttons: [...document.querySelectorAll(sel + " button, " + sel + " .el-button")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 8)
    };
  }, p.sheet);
  try {
    const pdf = await page.cdp("Page.printToPDF", { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315 });
    await fs.writeFile(OUT + p.code + "-native.pdf", Buffer.from(pdf.data, "base64"));
  } catch (e) { printInfo.pdfErr = String(e).slice(0, 80); }
  await page.evaluate(() => { document.body.classList.remove("approval-printing"); document.documentElement.style.removeProperty("--print-zoom"); });
  out.push({ panel: p.code, info, clicked, host: { host: host.host, printCalled: host.printCalled, w: host.w, hgt: host.hgt }, printInfo });
  console.log(JSON.stringify(out[out.length - 1]));
}
console.log("DONE");
