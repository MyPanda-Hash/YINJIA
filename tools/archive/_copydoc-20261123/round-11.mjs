const task = await taskSpace("copydoc-20261123");
await task.finish({ keep: [] });
console.log("closed");
