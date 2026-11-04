import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * 规格书「检验项目 / 检验子项」两列不能编辑(2026-11-04 用户第二次报障,第一次我修错了方向):
 *   用户口径:「检验项目那一列的那个什么炭棒尺寸、重量这一列**行头**的表格内容不能编辑,
 *             其他的表格内容是可以编辑的」
 *
 * 症状对照(截图):同一行里
 *   · 「检验要求 / 检验方法 / 检验依据」三列 **能** 编辑;
 *   · 「检验项目(组名)/ 检验子项」两列 **不能**。
 *
 * 根因在绑定方式不同(RecordSheetPanels.vue 的分组式数据行):
 *   · 能编辑的三列:`v-model="r.row['检验要求']"` —— 双向绑定,组件内部持值;
 *   · 不能编辑的两列:`:model-value="r.group.label"` + `@change="renameGroup(...)"`
 *     —— **单向绑定**:值来自 props 的派生数据,用户一敲字,DOM 的 value 立刻被 Vue
 *        用旧的 model-value 覆盖回去;而 `@change` 对 textarea 要**失焦**才触发,
 *        所以键盘输入在失焦前根本留不住 —— 用户看到的就是"点了没反应/打不进去"。
 *
 * 修法:两列改成 **`v-model` 绑到行数据上的真值**,并在 `@input` 里把改动同步进
 *   「检验项目 / 检验子项」两个数据键(组名要整组同步,子项只改本行 —— 沿用已有
 *   renameGroup / renameSub 的业务语义,但触发时机从 change 改成 input)。
 *
 * 这条测试是**源码不变量**测试(项目里同类做法见 core/views/*.test.js):
 *   它读 RecordSheetPanels.vue 源码,钉死"这两列不许再退回单向绑定"。
 *   为什么不用浏览器测:回弹是 Vue 的响应式时序,单测跑不出浏览器时序;
 *   而"绑定是不是 v-model"恰恰是决定性的那一点,读源码最可靠。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const PANEL_SRC = readFileSync(resolve(HERE, 'RecordSheetPanels.vue'), 'utf8')

/** 取出「分组式数据行」那一段模板(从 groupCol 数据行开始到该 template 结束) */
function groupRowBlock() {
  const start = PANEL_SRC.indexOf('<template v-if="dt.design?.groupCol">')
  assert.ok(start > 0, '找不到分组式数据行模板块')
  // 这段以 `</template>` 结束,但内部还有嵌套 template,故按"下一个非分组行 tr"定位更稳
  const end = PANEL_SRC.indexOf('<tr v-else v-for="(row, i) in rowsOf(dt)"', start)
  assert.ok(end > start, '找不到分组行块的结束位置')
  return PANEL_SRC.slice(start, end)
}

test('「检验项目」(组名)必须是 v-model 双向绑定,不能是 :model-value 单向', () => {
  const blk = groupRowBlock()
  // 组名格:绑的是 r.groupLabel(可写初值),不再是派生的 r.group.label
  const groupInput = blk.match(/<el-input[^>]*v-model="r\.groupLabel"[^>]*\/?>|<el-input[^>]*:model-value="r\.group\.label"[^>]*\/?>/s)
  assert.ok(groupInput, '找不到组名输入框(v-model="r.groupLabel" 或旧的 :model-value="r.group.label")')
  const tag = groupInput[0]
  assert.ok(/v-model/.test(tag),
    '组名输入框必须用 v-model(双向)。用 :model-value 时用户敲的字会被 Vue 立刻回弹成旧值,' +
    '而 @change 对 textarea 要失焦才触发 ⇒ 表现就是"打不进去"\n实际标签:' + tag)
  assert.ok(!/:model-value\s*=\s*"r\.group\.label"/.test(tag),
    '组名**输入框标签**里不能再用 :model-value="r.group.label"(单向)\n实际标签:' + tag)
})

test('「检验子项」必须同样是 v-model 双向绑定', () => {
  const blk = groupRowBlock()
  const subInput = blk.match(/<el-input[^>]*v-model="r\.subLabel"[^>]*\/?>|<el-input[^>]*:model-value="r\.sub"[^>]*\/?>/s)
  assert.ok(subInput, '找不到检验子项输入框')
  const tag = subInput[0]
  assert.ok(/v-model/.test(tag),
    '子项输入框必须用 v-model(双向);单向绑定会让输入立刻回弹\n实际标签:' + tag)
})

test('两列的改动要在 @input 时同步(不能只在 @change 失焦才同步)', () => {
  const blk = groupRowBlock()
  const groupTag = blk.match(/<el-input[^>]*v-model="r\.groupLabel"[^>]*\/?>/s)?.[0] || ''
  const subTag = blk.match(/<el-input[^>]*v-model="r\.subLabel"[^>]*\/?>/s)?.[0] || ''
  for (const [name, tag] of [['组名', groupTag], ['子项', subTag]]) {
    assert.ok(tag, `找不到${name}输入框`)
    assert.ok(/@input/.test(tag),
      `${name}列缺 @input 实时同步;只用 @change 时 textarea 要失焦才提交,界面看着像打不进去\n实际标签:` + tag)
  }
})

test('对照:能编辑的三列仍是 v-model(防误伤)', () => {
  const blk = groupRowBlock()
  for (const key of ['检验要求', '检验方法', '检验依据']) {
    const re = new RegExp(`v-model="r\\.row\\['${key}'\\]"`)
    assert.ok(re.test(blk), `${key} 列原本就是 v-model,不许被改动`)
  }
})

test('这一页不该再铺空白行(2026-11-04 用户明确否掉)', () => {
  // 上一轮我加过 autoSeqBar + blankRows:10,用户回:「新建草稿现在会铺 10 行空行这个不要」
  const CFG_SRC = readFileSync(resolve(HERE, 'recordSheetConfigs.js'), 'utf8')
  const m = CFG_SRC.match(/filterVal: '检验要求'[\s\S]{0,200}?cols:/)
  assert.ok(m, '找不到规格书检验项目表的配置块')
  assert.ok(!/blankRows/.test(m[0]),
    '规格书检验项目表不许配 blankRows(用户明确不要铺空白行)')
  assert.ok(!/autoSeqBar/.test(m[0]),
    '规格书检验项目表不许配 autoSeqBar(它是给 blankRows 铺行用的)')
})
