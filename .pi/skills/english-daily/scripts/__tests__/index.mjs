// 测试聚合器（Node v22.22.2 兼容）。
// node --test <dir>/ 在本 Node 版本不递归目录，而把目录路径当模块入口解析；
// 本文件作为 __tests__/ 的目录入口（见 package.json "main"），导入全部测试文件，
// 使 `node --test .pi/skills/english-daily/scripts/__tests__/` 运行全部 15 个测试。
// 文件名非 *.test.mjs，故 glob 形式（node --test __tests__/*.test.mjs）不会重复运行。
import './vocab.test.mjs';
import './pick-words.test.mjs';
import './mark-used.test.mjs';
