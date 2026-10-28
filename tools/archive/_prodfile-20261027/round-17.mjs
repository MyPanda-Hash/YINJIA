const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

// #11:标注相关新文案是否出现在构建产物里;annPenReady 逻辑是否打进包
const check = await page.evaluate(async () => {
  const out = {};
  // 取当前加载的 PanelxList chunk
  const srcs = [...document.querySelectorAll("script[src]")].map((s) => s.src);
  out.chunks = srcs.filter((s) => /PanelxList|RecordSheetPanels|AnnotatedText/.test(s));
  // 直接搜 chunk 文本里的关键字(标注简化 + 多行序号)
  const probe = async (frag) => {
    for (const s of srcs) {
      const t = await (await fetch(s)).text();
      if (t.includes(frag)) return true;
    }
    // 动态 chunk 要按 modulepreload 也找一遍
    const links = [...document.querySelectorAll("link[rel=modulepreload]")].map((l) => l.href);
    for (const s of links) {
      const t = await (await fetch(s)).text();
      if (t.includes(frag)) return true;
    }
    return false;
  };
  out.hasPenReadyText = await probe("直接在纸面上划选文字即可标注");
  out.startsWithSuffix = await probe("-tb");
  return out;
});
console.log("CHECK=" + JSON.stringify(check, null, 1));

await task.finish({ keep: [] });
