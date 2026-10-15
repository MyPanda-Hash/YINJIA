import fs from 'node:fs'
const files=['backend/src/main/java/com/yinjia/mes/service/QuickScheduleService.java','backend/src/main/java/com/yinjia/mes/service/ProcessTaskService.java']
const quick=fs.readFileSync(files[0],'utf8'), proc=fs.readFileSync(files[1],'utf8')
if(!quick.includes('String batch = null')) throw Error('transfer still creates batch')
if(!quick.includes('plNo + "#" + lineNo')) throw Error('flow key still depends on batch')
if(!proc.includes('assignProductionBatch')) throw Error('completion batch assignment missing')
if(!proc.includes('LocalDate.now().format')) throw Error('completion date generation missing')
console.log('PASS deferred batch source guards: transfer=null, completion assigns date, flow key row-based')
