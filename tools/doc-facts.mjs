/* ============================================================
   doc-facts.mjs — portfolio 的「文档事实契约」

   每行 = 一条「代码里能算出来的真值」→「文档里哪句话必须等于它」。
   加新断言就往 facts / sets 里加一项，不用改引擎。
   正则一律用字面量，避免 JSON 双重转义。

   上次偏移就是靠这套抓的：文档写 6 条项目 / collect 6/6，实际 7 条 / 7/7。
   ============================================================ */

export const facts = [
  {
    id: 'projects.count',
    desc: 'projects.json 里的项目条数',
    from: { kind: 'jsonPath', file: 'projects.json', path: 'projects.length' },
    expect: [
      { doc: 'docs/交接文档.md', pattern: /(\d+) 条项目/, label: 'N 条项目', hint: '改 §一 文件职责表' },
      { doc: 'docs/交接文档.md', pattern: /`projects\.length`（当前 (\d+)）/, label: 'projects.length（当前 N）', hint: '改 §八 自检清单' },
      { doc: 'docs/交接文档.md', pattern: /\*\*(\d+)\/\d+ 成功 · 0 失败\*\*/, label: 'collect N/N', hint: '改 §八 自检清单' },
      { doc: 'docs/README.md',   pattern: /应 (\d+)\/\d+/, label: 'collect 应 N/N', hint: '改「一分钟上手」的命令注释' },
    ],
  },
  {
    id: 'rules.clauses',
    desc: '规则条款总数',
    from: { kind: 'jsonPath', file: 'docs/data/rules-map.json', path: 'counts.clauses' },
    expect: [{ doc: 'docs/交接文档.md', pattern: /条款 (\d+) ·/, label: '条款 N', hint: '改 §七 当前读数' }],
  },
  {
    id: 'rules.covered',
    desc: '已覆盖条款数',
    from: { kind: 'jsonPath', file: 'docs/data/rules-map.json', path: 'counts.covered' },
    expect: [{ doc: 'docs/交接文档.md', pattern: /已覆盖 (\d+) ·/, label: '已覆盖 N', hint: '改 §七 当前读数' }],
  },
  {
    id: 'rules.anchors',
    desc: '测试锚点数',
    from: { kind: 'jsonPath', file: 'docs/data/rules-map.json', path: 'counts.anchors' },
    expect: [{ doc: 'docs/交接文档.md', pattern: /锚点 (\d+)/, label: '锚点 N', hint: '改 §七 当前读数' }],
  },
  {
    id: 'collect.success',
    desc: '实跑 npm run collect 的成功数（--full 才跑）',
    from: {
      kind: 'command', cmd: ['node', 'build-collect.js'],
      pattern: /✅ 成功:\s*(\d+)/, timeout: 180000,
      onError: 'warn',   // CI 少源目录时只警告，不把部署卡在环境差异上
    },
    expect: [{ doc: 'docs/README.md', pattern: /应 (\d+)\/\d+/, label: 'collect 应 N/N' }],
  },
];

export const sets = [
  {
    id: 'changelog.index',
    desc: 'docs/变更记录/README.md 的索引表必须与实际记录文件一一对应',
    code: {
      dir: 'docs/变更记录',
      filePattern: /^\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}_.+\.md$/,
    },
    doc: {
      file: 'docs/变更记录/README.md',
      pattern: /\]\(\.\/(\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}_[^)]+\.md)\)/g,
      group: 1,
    },
    codeLabel: '实际记录文件',
    docLabel: '索引表',
    docOnlyHint: '索引指向了不存在的文件，删掉该行',
    codeOnlyHint: '补了记录没进索引，往 docs/变更记录/README.md 的表里加一行',
  },
];
