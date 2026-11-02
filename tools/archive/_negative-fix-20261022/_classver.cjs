/** 读 class 文件头里的 major version */
const fs = require('node:fs')
const files = process.argv.slice(2)
for (const f of files) {
  const b = fs.readFileSync(f)
  // magic(4) minor(2) major(2)
  const major = b.readUInt16BE(6)
  console.log(`${f}  → major ${major} (Java ${major - 44})`)
}
