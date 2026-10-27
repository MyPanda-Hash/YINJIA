const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

// #5:在真实页面里跑一次"标准库条目 → 多行带序号"的纯逻辑(模块已在 bundle 里)
// 做法:直接取 RecordSheetPanels 那个 chunk,用同样的正则跑一遍;更可靠的是断言行为:
//   打开 配料要求 的「⌄ 标准库」弹窗,里面多行条目点「填入」后 textarea 应是 "1. x\n2. y"
const r = await page.evaluate(async () => {
  // 直接从已加载的模块图里拿不到 export,改用 DOM 行为验证:
  // 找「配料要求」那一行的 ⌄ 标准库 按钮
  const btns = [...document.querySelectorAll(".rsp-lib-pick")];
  return { libPickCount: btns.length, texts: btns.map((b) => (b.textContent || "").trim()).slice(0, 10) };
});
console.log("LIBBTN=" + JSON.stringify(r));

// 再看构建产物里 sectionLibText 的关键实现(带序号拼接)是否在包内
const has = await page.evaluate(async () => {
  const links = [...document.querySelectorAll("link[rel=modulepreload]")].map((l) => l.href);
  const srcs = [...document.querySelectorAll("script[src]")].map((s) => s.src);
  const all = [...new Set([...links, ...srcs])];
  for (const u of all) {
    try {
      const t = await (await fetch(u)).text();
      if (t.includes(".split") && t.includes("\\n") && /\\d\\+\"\\. \"/.test(t)) return { hit: true, url: u.slice(-40) };
      // 宽松点:找 "1. " 的模板拼接特征
      if (t.includes("${") && t.includes(". ") && t.includes("stripSeq")) return { hit: true, url: u.slice(-40) };
    } catch {}
  }
  // 兜底:直接抓 RecordSheetPanels chunk
  const idx = all.find((u) => u.includes("RecordSheetPanels"));
  if (idx) {
    const t = await (await fetch(idx)).text();
    return { hit: t.includes("strip") || t.includes("\\r\\n"), url: idx.slice(-50), len: t.length };
  }
  return { hit: false, all: all.length };
});
console.log("SECTIONLIB=" + JSON.stringify(has));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-13.json", JSON.stringify({ r, has }, null, 2), "utf8");
await task.finish({ keep: [] });
