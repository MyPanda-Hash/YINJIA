const task = await taskSpace(51);
await task.finish({ keep: [] });
console.log("space finished");
