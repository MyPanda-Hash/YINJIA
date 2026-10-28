/**
 * sectionLibText.js — 章节标准库条目「填入」文本框时的排版(纯函数,可 node --test)
 *
 * 【用户口径】2026-10-27(1027系统使用-产品工艺文件问题点待改善 #5):
 *   「章节标准库·配料要求:支持多行同步填入文本框,多行填充时赋予序号」
 *
 * 白话:标准库条目本来就是多行文本(一行一道配料工序),点「填入」后要
 *   **原样多行落进文本框**,并且**每行前面自动带序号**(1. 2. 3. …)。
 *
 * 【为什么单独抽出来】
 *   这是"贴进去看着对、其实坏了"的典型:
 *     · 有些条目存的时候已经带 `1.` `2.`(人工录的),再补一遍就成 `1. 1. 称料`;
 *     · 空行(条目末尾/中间的空行)补了序号就是一行孤零零的 `4.`,纸面上很扎眼;
 *     · 换行符可能是 \r\n / \n / \r(VBS/Excel 粘贴来源混杂),按 \n 切会把 \r 留在行尾。
 *   这些都不会报错,只会在受控文书上留下脏格式 ⇒ 收敛成纯函数 + 单测钉住。
 *
 * 规则(顺序固定):
 *   ① 统一换行符 → \n;
 *   ② 按行切,**丢掉空行**(全空白行不占号、不产出空序号行);
 *   ③ 每行先剥掉已有的序号前缀(`1.` `1、` `1)` `(1)` `1．` 等),再补 `n. `;
 *   ④ 单行条目**也补序号**(与多行同一口径,纸面观感一致;用户口径"多行填充时赋予序号"
 *      指的是多行场景,但单行补号不会让人困惑,且避免同一字段出现两种排版)。
 *
 * @param {unknown} content 标准库条目正文(可能含 \r\n、已有序号、空行)
 * @returns {string} 可直接写进 textarea 的文本(每行 `n. 正文`,行间 \n)
 */
export function sectionLibText(content) {
  const raw = content === null || content === undefined ? '' : String(content)
  // ① 统一换行符(\r\n 先处理,再处理裸 \r)
  const normalized = raw.replace(/\r\n?/g, '\n')
  // ② 切行 + 丢空行(全空白也算空,不占号)
  const lines = normalized
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (!lines.length) return ''
  // ③ 剥已有序号 + 补新序号
  const numbered = lines.map((line, i) => `${i + 1}. ${stripSeq(line)}`)
  return numbered.join('\n')
}

/**
 * 剥掉行首已有的序号前缀(有就剥,没有原样返回)。
 * 认得的写法:`1.` `1、` `1)` `1）` `1．` `(1)` `（1）` `一.` `一、`
 * ⚠ 只剥**行首**、且序号后必须紧跟分隔符 —— 否则「100%炭粉」会把 100 当序号剥掉。
 */
export function stripSeq(line) {
  const s = String(line ?? '').trim()
  if (!s) return ''
  // 阿拉伯数字:后接 . 、 ) ） ． 全角句点 或 空白
  const arabic = s.replace(/^(\d{1,3})\s*[.、)）．]\s*/, '')
  if (arabic !== s) return arabic.trim()
  // 括号包住的数字:(1) （1）
  const paren = s.replace(/^[(（]\s*(\d{1,3})\s*[)）]\s*/, '')
  if (paren !== s) return paren.trim()
  // 中文数字:一、 二. (最多三位,避免误剥「一定」这类词)
  const cn = s.replace(/^([一二三四五六七八九十]{1,3})\s*[.、．]\s*/, '')
  if (cn !== s) return cn.trim()
  return s
}
