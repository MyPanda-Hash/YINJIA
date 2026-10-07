// _cfg-keys.cjs — 只列 config.json 字段名与值形态,不输出任何密钥明文
const c = JSON.parse(require('fs').readFileSync('deploy/push/config.test.json', 'utf8'));
const walk = (o, p) => {
  for (const k in o) {
    const v = o[k];
    const path = p + k;
    if (v && typeof v === 'object') walk(v, path + '.');
    else if (/secret|key|password/i.test(k) && typeof v === 'string' && v) console.log(path, '= <' + v.length + '字符,已隐去>');
    else console.log(path, '=', JSON.stringify(v));
  }
};
walk(c, '');
