import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('production work-order recipe flow is line-scoped and permission-gated', () => {
  const page = read('frontend/src/views/modules/plan/WorkOrderList.vue')
  const controller = read('backend/src/main/java/com/yinjia/mes/controller/WorkOrderListController.java')
  const registry = read('backend/src/main/java/com/yinjia/mes/service/PagePanelRegistry.java')
  const permissions = read('backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java')
  assert.match(page, /canDo\('recipe'\)/)
  assert.match(page, /工单号: r\.工单号, 行id: r\.行id, 混料数量:/)
  assert.match(controller, /@PostMapping\("\/workOrderList\/recipe"\)/)
  assert.match(controller, /@PostMapping\("\/workOrderList\/mixing"\)/)
  assert.match(controller, /requireButton\(PagePanelRegistry\.WORK_ORDER_LIST, "获取混料配方"\)/)
  assert.match(registry, /\{"recipe",\s*"获取混料配方"\}/)
  assert.match(permissions, /WORK_ORDER_LIST \+ "\|获取混料配方", new String\[\]\{"recipe"\}/)
})

test('production mix snapshots use an approved molding formula and the actual ratio', () => {
  const service = read('backend/src/main/java/com/yinjia/mes/service/WorkOrderRecipeService.java')
  const migration = read('tools/migrate-wo-mold-recipe-link.sql')
  assert.match(service, /ISNULL\(s\.archived,'N'\)='Y'/)
  assert.ok(service.includes("s.shr"))
  assert.match(service, /Double ratio = parseRatio\(actual\)/)
  assert.doesNotMatch(service, /actual\.isBlank\(\) \? design/)
  assert.match(service, /mixingQty \* item\.singleContent\(\)/)
  assert.match(service, /asp_cancel='Y'.*WHERE 工单行id/s)
  assert.match(migration, /CREATE TABLE dbo\.wo_mixing_head/)
  assert.match(migration, /CREATE TABLE dbo\.wo_mixing_detail/)
  assert.match(migration, /MS_Description/)
})

test('new mixing UI strings have English translations', () => {
  const en = read('frontend/src/i18n/locales/en.js')
  for (const phrase of ['获取混料配方', '成型配方', '混料数量', '配料比', '计划用量', '确认获取', '混料配方获取失败']) {
    assert.match(en, new RegExp(`['"]${phrase}['"]\\s*:`), `${phrase} needs an en translation`)
  }
})
