const spaces = await listTaskSpaces()
console.log('SPACES=' + JSON.stringify(spaces.map((s) => ({ id: s.id, name: s.name, ownership: s.ownership, pages: s.pages })), null, 1))
console.log('DONE round-13')
