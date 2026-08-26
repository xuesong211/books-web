import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = process.env.WUXIA_LIBRARY_ROOT || 'C:\\Users\\18811\\Documents\\Codex\\2026-08-25\\realtime-voice-chat\\outputs\\wuxia-history-deep-craft-library';
const outputRoot = path.resolve('public/data');

const read = (...parts) => fs.readFileSync(path.join(sourceRoot, ...parts), 'utf8').replace(/\r\n/g, '\n');
const clean = (value = '') => value.trim().replace(/\s+/g, ' ');
const number = (value = '0') => Number(value.replace(/[,%]/g, ''));
const between = (text, start, end) => {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) return '';
  const bodyStart = startIndex + start.length;
  const endIndex = end ? text.indexOf(end, bodyStart) : -1;
  return text.slice(bodyStart, endIndex < 0 ? undefined : endIndex).trim();
};
const bullets = (text) => text.split('\n').filter((line) => line.startsWith('- ')).map((line) => clean(line.slice(2)));
const numbered = (text) => text.split('\n').filter((line) => /^\d+\. /.test(line)).map((line) => clean(line.replace(/^\d+\. /, '')));
const firstLine = (text) => clean(text.split('\n').find((line) => line.trim()) || '');
const field = (text, label) => clean(text.match(new RegExp(`^- ${label}：(.+)$`, 'm'))?.[1] || '');

function parseEvidence(line) {
  const match = line.match(/^- `([^`]+)` \[([^\]]+)\]\(([^)]+)\)，([^：]+)：(.+)$/);
  if (!match) return null;
  const card = match[3].match(/section-(\d+)\.md/)?.[1];
  return {
    sourceId: match[1],
    title: clean(match[2]),
    cardId: card ? `section-${card}` : '',
    location: clean(match[4]),
    note: clean(match[5]),
  };
}

function parseSources() {
  const rows = read('sources.md').split('\n').filter((line) => /^\| wh-/.test(line));
  return rows.map((line, index) => {
    const cells = line.split('|').slice(1, -1).map(clean);
    return {
      id: cells[0],
      title: cells[1].replace(/^《|》$/g, ''),
      author: cells[2],
      type: cells[3],
      characters: number(cells[4]),
      sections: number(cells[5]),
      dialogueRatio: number(cells[6]),
      strongEndingRatio: number(cells[7]),
      group: index < 14 ? 'history' : 'wuxia',
    };
  });
}

function parseOverview(source) {
  const text = read('books', source.id, 'overview.md');
  const detailedType = field(text, '类型');
  const stats = text.match(/句长均值 \/ 中位数 \/ 九十分位：([\d.]+) \/ ([\d.]+) \/ ([\d.]+)/);
  const punctuation = text.match(/问号 \/ 感叹号（每万字）：([\d.]+) \/ ([\d.]+)/);
  return {
    ...source,
    format: clean(detailedType.split('/')[0] || ''),
    descriptor: clean(detailedType.split('/').slice(1).join('/') || source.type),
    boundaryConfidence: field(text, '章节边界置信度'),
    relation: field(text, '连续关系'),
    narrativeCore: firstLine(between(text, '## 叙事核心', '## 结构骨架')),
    skeleton: firstLine(between(text, '## 结构骨架', '## 可迁移长处')),
    strengths: bullets(between(text, '## 可迁移长处', '## 统计指纹')),
    useLimit: firstLine(between(text, '## 使用限制')),
    stats: {
      averageSentence: number(stats?.[1]),
      medianSentence: number(stats?.[2]),
      p90Sentence: number(stats?.[3]),
      questionRate: number(punctuation?.[1]),
      exclamationRate: number(punctuation?.[2]),
    },
  };
}

function parseCard(sourceId, filename) {
  const text = read('books', sourceId, 'chapters', filename);
  const heading = text.match(/^# (\d+) · (.+)$/m);
  const metrics = text.match(/字符 \/ 句子 \/ 段落：([\d,]+) \/ ([\d,]+) \/ ([\d,]+)/);
  const sentence = text.match(/句长均值 \/ 标准差：([\d.]+) \/ ([\d.]+)/);
  const cardId = filename.replace('.md', '');
  return {
    id: cardId,
    order: number(heading?.[1]),
    title: clean(heading?.[2] || filename),
    sourceId,
    location: field(text, '定位'),
    sectionType: field(text, '分段类型').split('—')[0].trim(),
    sectionNote: clean(field(text, '分段类型').split('—').slice(1).join('—')),
    metrics: {
      characters: number(metrics?.[1]),
      sentences: number(metrics?.[2]),
      paragraphs: number(metrics?.[3]),
      averageSentence: number(sentence?.[1]),
      sentenceDeviation: number(sentence?.[2]),
      dialogueRatio: number(field(text, '对话占比')),
    },
    state: {
      before: field(text, '前态'),
      action: field(text, '推进'),
      after: field(text, '后态'),
      mechanisms: field(text, '主导机制').replace(/。$/, '').split('、').filter(Boolean),
    },
    participants: {
      primary: field(text, '主要候选').split('、').filter((item) => item && item !== '未可靠识别'),
      entered: field(text, '可能进入').split('、').filter((item) => item && item !== '无可靠变化'),
      exited: field(text, '可能离开').split('、').filter((item) => item && item !== '无可靠变化'),
      confidence: 'low-medium',
    },
    promise: {
      type: field(text, '类型').replace(/`/g, ''),
      status: field(text, '状态').replace(/`/g, ''),
      note: field(text, '说明'),
    },
    dimensions: [...text.matchAll(/^- \[([^\]]+)\]\(\.\.\/\.\.\/\.\.\/dimensions\/([^)]+)\)$/gm)].map((match) => ({ title: match[1], slug: match[2].replace('.md', '') })),
  };
}

function parseLedger(sourceId) {
  const text = read('books', sourceId, 'continuity-ledger.md');
  const participantText = between(text, '## 高频参与者候选', '这些名称由规则抽取');
  const mechanismText = between(text, '## 主导场景机制分布', '## 章末承诺状态');
  const promiseText = between(text, '## 章末承诺状态', '## 使用方法');
  const countItems = (body) => bullets(body).map((item) => {
    const match = item.match(/^(.+?)(?:：|：`?)(\d+)/);
    return match ? { name: match[1].replace(/`/g, ''), count: number(match[2]) } : null;
  }).filter(Boolean);
  return {
    relation: firstLine(between(text, '## 来源关系', '## 高频参与者候选')),
    participants: bullets(participantText).map((item) => {
      const match = item.match(/^(.+?)：(\d+) 个分段候选出现$/);
      return match ? { name: match[1], count: number(match[2]) } : null;
    }).filter(Boolean),
    mechanisms: countItems(mechanismText),
    promises: countItems(promiseText),
  };
}

function parseDimension(filename) {
  const slug = filename.replace('.md', '');
  const text = read('dimensions', filename);
  return {
    slug,
    title: clean(text.match(/^# (.+)$/m)?.[1] || slug),
    judgment: firstLine(between(text, '## 核心判断', '## 可执行控制项')),
    controls: numbered(between(text, '## 可执行控制项', '## 常见失效')),
    failures: bullets(between(text, '## 常见失效', '## 跨来源证据')),
    evidence: between(text, '## 跨来源证据', '## 验收问题').split('\n').map(parseEvidence).filter(Boolean),
    questions: bullets(between(text, '## 验收问题')),
  };
}

function parseSynthesis() {
  const text = read('synthesis.md');
  const comboBody = between(text, '## 六个高价值组合', '## 深度写作的三层账本');
  const comboMatches = [...comboBody.matchAll(/^### (\d+)\. (.+)$/gm)];
  const combinations = comboMatches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = comboMatches[index + 1]?.index ?? comboBody.length;
    return { id: number(match[1]), title: match[2], body: clean(comboBody.slice(start, end)) };
  });
  const ledgerRows = between(text, '## 深度写作的三层账本', '## 反事后必然').split('\n').filter((line) => /^\| (人物|关系\/组织|历史\/世界)/.test(line)).map((line) => {
    const cells = line.split('|').slice(1, -1).map(clean);
    return { layer: cells[0], fields: cells[1], changes: cells[2] };
  });
  return {
    conclusion: firstLine(between(text, '## 总结论', '## 六个高价值组合')).replace(/\*\*/g, ''),
    combinations,
    ledgers: ledgerRows,
    antiInevitability: firstLine(between(text, '## 反事后必然', '## 跨来源证据')),
    evidence: between(text, '## 跨来源证据', '## 最小原创配方').split('\n').map(parseEvidence).filter(Boolean),
    recipe: numbered(between(text, '## 最小原创配方')),
  };
}

function parseControls() {
  const text = read('craft-controls.md');
  const headings = [...text.matchAll(/^## ([一二三四五六七八九]+)、(.+)$/gm)];
  return headings.map((match, index) => {
    const start = match.index + match[0].length;
    const end = headings[index + 1]?.index ?? text.length;
    const body = text.slice(start, end).trim();
    const rows = body.split('\n').filter((line) => /^\|/.test(line) && !/^\|---/.test(line)).slice(1).map((line) => line.split('|').slice(1, -1).map(clean));
    return {
      numeral: match[1],
      title: match[2],
      intro: body.split('\n').filter((line) => line.trim() && !/^[-\d|#]/.test(line.trim())).map((line) => clean(line.replace(/\*\*/g, '')))[0] || '',
      bullets: bullets(body),
      steps: numbered(body),
      rows,
    };
  });
}

function main() {
  fs.mkdirSync(path.join(outputRoot, 'sources'), { recursive: true });
  const sources = parseSources().map(parseOverview);
  const search = [];
  let cardCount = 0;
  for (const source of sources) {
    const chapterDir = path.join(sourceRoot, 'books', source.id, 'chapters');
    const cards = fs.readdirSync(chapterDir).filter((name) => /^section-\d+\.md$/.test(name)).sort().map((name) => parseCard(source.id, name));
    cardCount += cards.length;
    const payload = { source, ledger: parseLedger(source.id), cards };
    fs.writeFileSync(path.join(outputRoot, 'sources', `${source.id}.json`), JSON.stringify(payload));
    for (const card of cards) {
      search.push({
        id: card.id,
        sourceId: source.id,
        sourceTitle: source.title,
        group: source.group,
        format: source.format,
        title: card.title,
        location: card.location,
        mechanisms: card.state.mechanisms,
        state: `${card.state.before} ${card.state.after}`,
        promise: `${card.promise.type} ${card.promise.status} ${card.promise.note}`,
        participants: card.participants.primary.slice(0, 6),
      });
    }
  }
  const dimensions = fs.readdirSync(path.join(sourceRoot, 'dimensions')).filter((name) => name.endsWith('.md')).sort().map(parseDimension);
  const catalog = {
    stats: { sources: sources.length, cards: cardCount, dimensions: dimensions.length, wuxia: sources.filter((item) => item.group === 'wuxia').length, history: sources.filter((item) => item.group === 'history').length },
    sources,
    dimensions,
    synthesis: parseSynthesis(),
    controls: parseControls(),
    relationships: [
      { id: 'ming', title: '《明朝那些事儿》七册', note: '仅保留卷册顺序关系', sourceIds: sources.slice(4, 11).map((item) => item.id) },
      { id: 'trilogy', title: '射雕 → 神雕 → 倚天', note: '广义代际连续；主角线不合并', sourceIds: ['wh-19-9967a688', 'wh-21-1415d816', 'wh-17-71660a2a'] },
      { id: 'fox', title: '飞狐外传 → 雪山飞狐', note: '共享前史与人物连续性', sourceIds: ['wh-26-f0bcf311', 'wh-25-357edb8c'] },
    ],
    notices: {
      historical: '历史材料中的事实、数字、引文与因果解释仍需外部核验；小说化场景、对白与内心只视为创作重构。',
      participants: '参与者由规则启发式识别，置信度为低到中；可能混入称谓、地名或动作词，只能用于导航。',
      evidence: '“EPUB section N, lines A–B”只定位当前电子版的规范化分段，不等同于纸书页码。',
    },
  };
  fs.writeFileSync(path.join(outputRoot, 'catalog.json'), JSON.stringify(catalog));
  fs.writeFileSync(path.join(outputRoot, 'search.json'), JSON.stringify(search));
  console.log(`Generated ${sources.length} sources, ${cardCount} cards, ${dimensions.length} dimensions.`);
}

main();
