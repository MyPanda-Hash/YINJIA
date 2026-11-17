const spaces = await listTaskSpaces()
console.log(JSON.stringify(spaces.map((s) => ({ id: s.id, name: s.name, owner: s.ownership })), null, 2))
