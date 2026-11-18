const task = await taskSpace(52);
await task.finish({ keep: [] });
console.log("space finished");
