'use client';

import { useEffect, useMemo, useState } from 'react';
import catalogJson from '../public/data/catalog.json';

type View = 'synthesis' | 'controls' | 'sources' | 'dimensions' | 'cards';
type Group = 'all' | 'wuxia' | 'history';
type Source = { id: string; title: string; author: string; type: string; group: 'wuxia' | 'history'; format: string; descriptor: string; characters: number; sections: number; dialogueRatio: number; strongEndingRatio: number; relation: string; narrativeCore: string; skeleton: string; strengths: string[]; useLimit: string; boundaryConfidence: string; stats: { averageSentence: number; medianSentence: number; p90Sentence: number; questionRate: number; exclamationRate: number } };
type Evidence = { sourceId: string; title: string; cardId: string; location: string; note: string };
type Dimension = { slug: string; title: string; judgment: string; controls: string[]; failures: string[]; evidence: Evidence[]; questions: string[] };
type Card = { id: string; order: number; title: string; sourceId: string; location: string; sectionType: string; sectionNote: string; metrics: { characters: number; sentences: number; paragraphs: number; averageSentence: number; sentenceDeviation: number; dialogueRatio: number }; state: { before: string; action: string; after: string; mechanisms: string[] }; participants: { primary: string[]; entered: string[]; exited: string[]; confidence: string }; promise: { type: string; status: string; note: string }; dimensions: { title: string; slug: string }[] };
type SourcePayload = { source: Source; ledger: { relation: string; participants: { name: string; count: number }[]; mechanisms: { name: string; count: number }[]; promises: { name: string; count: number }[] }; cards: Card[] };
type SearchItem = { id: string; sourceId: string; sourceTitle: string; group: 'wuxia' | 'history'; format: string; title: string; location: string; mechanisms: string[]; state: string; promise: string; participants: string[] };
type Control = { numeral: string; title: string; intro: string; bullets: string[]; steps: string[]; rows: string[][] };
type Catalog = { stats: { sources: number; cards: number; dimensions: number; wuxia: number; history: number }; sources: Source[]; dimensions: Dimension[]; synthesis: { conclusion: string; combinations: { id: number; title: string; body: string }[]; ledgers: { layer: string; fields: string; changes: string }[]; antiInevitability: string; evidence: Evidence[]; recipe: string[] }; controls: Control[]; relationships: { id: string; title: string; note: string; sourceIds: string[] }[]; notices: { historical: string; participants: string; evidence: string } };

const catalog = catalogJson as unknown as Catalog;
const viewLabels: Record<View, string> = { synthesis: '综合蒸馏', controls: '创作控制台', sources: '来源浏览', dimensions: '维度分析', cards: '分段卡' };
const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
const groupLabel = (value: Group) => value === 'wuxia' ? '武侠小说' : value === 'history' ? '历史相关' : '全部来源';
const promiseLabel = (value: string) => ({ open: '开放承诺', 'paid-or-partial': '已回收 / 部分回收', transition: '过渡' }[value] || value);

function Notice({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) {
  return <p className={'notice ' + (warning ? 'warning' : '')}>{children}</p>;
}

function EvidenceList({ items, onOpen }: { items: Evidence[]; onOpen: (sourceId: string, cardId: string) => void }) {
  return <div className="evidence-list">{items.map((item) => <button className="evidence-item" type="button" onClick={() => onOpen(item.sourceId, item.cardId)} key={item.sourceId + item.cardId}><span className="evidence-pin">证据</span><span><strong>{item.title}</strong><small>{item.location}</small><em>{item.note}</em></span><b aria-hidden="true">↗</b></button>)}</div>;
}

function MetricBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.min(100, value / max * 100)) + '%';
  return <div className="metric-bar"><span>{label}</span><i><b style={{ width }} /></i><strong>{value}</strong></div>;
}

export default function Home() {
  const [view, setView] = useState<View>('synthesis');
  const [sourceGroup, setSourceGroup] = useState<Group>('all');
  const [sourceType, setSourceType] = useState('all');
  const [sourceQuery, setSourceQuery] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [payloads, setPayloads] = useState<Record<string, SourcePayload>>({});
  const [sourcePage, setSourcePage] = useState(1);
  const [bookCardQuery, setBookCardQuery] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [cardGroup, setCardGroup] = useState<Group>('all');
  const [cardPromise, setCardPromise] = useState('all');
  const [cardMechanism, setCardMechanism] = useState('all');
  const [searchItems, setSearchItems] = useState<SearchItem[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedDimension, setSelectedDimension] = useState('plotting');
  const [selectedCombo, setSelectedCombo] = useState(1);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [brief, setBrief] = useState({ position: '', desire: '', dutyA: '', dutyB: '', consequence: '' });
  const [copied, setCopied] = useState(false);

  const getSource = (id: string) => catalog.sources.find((item) => item.id === id);
  const selectedPayload = selectedSourceId ? payloads[selectedSourceId] : undefined;
  const selectedSource = selectedPayload?.source || getSource(selectedSourceId);
  const setCurrentView = (next: View) => {
    setView(next); setMobileNavOpen(false);
    if (next === 'cards') void loadSearch();
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '#' + next);
  };
  const loadSearch = async () => {
    if (searchItems) return searchItems;
    const response = await fetch('/data/search.json');
    const data = await response.json() as SearchItem[];
    setSearchItems(data); return data;
  };
  const loadSource = async (id: string) => {
    if (payloads[id]) return payloads[id];
    const response = await fetch('/data/sources/' + id + '.json');
    if (!response.ok) return undefined;
    const data = await response.json() as SourcePayload;
    setPayloads((current) => ({ ...current, [id]: data }));
    return data;
  };
  const openSource = async (id: string) => {
    setSelectedSourceId(id); setSelectedCard(null); setSourcePage(1); setBookCardQuery(''); setCurrentView('sources');
    await loadSource(id);
  };
  const openCard = async (sourceId: string, cardId: string) => {
    setSelectedSourceId(sourceId); setCurrentView('cards');
    const data = await loadSource(sourceId);
    setSelectedCard(data?.cards.find((item) => item.id === cardId) || null);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '#cards/' + sourceId + '/' + cardId);
  };

  useEffect(() => {
    const parts = window.location.hash.slice(1).split('/');
    const timer = window.setTimeout(() => {
      if (Object.keys(viewLabels).includes(parts[0])) setView(parts[0] as View);
      if (parts[1] && parts[2]) void openCard(parts[1], parts[2]);
    }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); void loadSearch(); }
      if (event.key === 'Escape') { setSearchOpen(false); setMobileNavOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchItems]);
  const formats = useMemo(() => Array.from(new Set(catalog.sources.map((item) => item.format))).sort(), []);
  const filteredSources = useMemo(() => catalog.sources.filter((item) => {
    const haystack = (item.title + ' ' + item.author + ' ' + item.descriptor + ' ' + item.type).toLowerCase();
    return (sourceGroup === 'all' || item.group === sourceGroup) && (sourceType === 'all' || item.format === sourceType) && haystack.includes(sourceQuery.toLowerCase());
  }), [sourceGroup, sourceType, sourceQuery]);
  const sourceCards = selectedPayload?.cards || [];
  const sourceCardMatches = sourceCards.filter((item) => (item.title + ' ' + item.location + ' ' + item.state.mechanisms.join(' ')).includes(bookCardQuery));
  const listedSourceCards = sourceCardMatches.slice((sourcePage - 1) * 14, sourcePage * 14);
  const sourceCardPages = Math.max(1, Math.ceil(sourceCardMatches.length / 14));
  const mechanisms = useMemo(() => Array.from(new Set((searchItems || []).flatMap((item) => item.mechanisms))).sort(), [searchItems]);
  const cardResults = useMemo(() => (searchItems || []).filter((item) => {
    const haystack = (item.sourceTitle + ' ' + item.title + ' ' + item.mechanisms.join(' ') + ' ' + item.state + ' ' + item.promise + ' ' + item.participants.join(' ')).toLowerCase();
    return (cardGroup === 'all' || item.group === cardGroup) && (cardPromise === 'all' || item.promise.includes(cardPromise)) && (cardMechanism === 'all' || item.mechanisms.includes(cardMechanism)) && haystack.includes(cardQuery.toLowerCase());
  }).slice(0, 72), [searchItems, cardGroup, cardPromise, cardMechanism, cardQuery]);
  const activeDimension = catalog.dimensions.find((item) => item.slug === selectedDimension) || catalog.dimensions[0];
  const activeCombo = catalog.synthesis.combinations.find((item) => item.id === selectedCombo) || catalog.synthesis.combinations[0];
  const briefSentence = '一个' + (brief.position || '处于某种制度位置的人') + '，为了' + (brief.desire || '一个可见欲望') + '，必须在' + (brief.dutyA || '义务 A') + '与' + (brief.dutyB || '义务 B') + '之间选择，而选择会改变' + (brief.consequence || '共同体后果') + '。';
  const term = searchQuery.trim().toLowerCase();
  const quickSources = term ? catalog.sources.filter((item) => (item.title + item.author + item.descriptor).toLowerCase().includes(term)).slice(0, 5) : [];
  const quickDimensions = term ? catalog.dimensions.filter((item) => (item.title + item.judgment).toLowerCase().includes(term)).slice(0, 4) : [];
  const quickCards = term ? (searchItems || []).filter((item) => (item.sourceTitle + item.title + item.mechanisms.join(' ') + item.participants.join(' ')).toLowerCase().includes(term)).slice(0, 8) : [];
  const copyBrief = async () => { await navigator.clipboard?.writeText(briefSentence); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };

  return <main className="archive-shell">
    <header className="topbar">
      <button className="brand" type="button" onClick={() => setCurrentView('synthesis')} aria-label="武史藏经阁首页"><span className="brand-mark">武史</span><span><strong>武史藏经阁</strong><small>叙事技艺档案库</small></span></button>
      <nav aria-label="主导航">{(Object.keys(viewLabels) as View[]).map((item) => <button className={view === item ? 'active' : ''} type="button" key={item} onClick={() => setCurrentView(item)}>{viewLabels[item]}</button>)}</nav>
      <button className="search-button" type="button" onClick={() => { setSearchOpen(true); void loadSearch(); }} aria-label="打开全局搜索"><span>全局搜索</span><kbd>⌘ K</kbd></button>
      <button className="mobile-menu" type="button" aria-label="打开导航" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((value) => !value)}>☰</button>
    </header>
    {mobileNavOpen && <nav className="mobile-nav" aria-label="移动端导航">{(Object.keys(viewLabels) as View[]).map((item) => <button type="button" key={item} onClick={() => setCurrentView(item)}>{viewLabels[item]}</button>)}</nav>}

    {view === 'synthesis' && <section className="view-content synthesis-view">
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><span /> MODERN ARCHIVE · 2026</p><h1>从二十八部作品中，<br />提炼故事如何真正运转。</h1><p className="lede">一座面向原创写作的武侠 × 历史叙事知识库。沿来源、维度与证据定位，追踪状态变化，而非复刻原作。</p><div className="hero-actions"><button className="primary-action" type="button" onClick={() => document.getElementById('combos')?.scrollIntoView()}>进入综合蒸馏 <span>→</span></button><button className="text-action" type="button" onClick={() => setCurrentView('sources')}>浏览全部来源</button></div></div>
        <div className="archive-panel" aria-label="知识库规模概览"><div className="panel-head"><span>馆藏总览</span><span className="status-dot">已通过校验</span></div><div className="stat-grid"><div><strong>{catalog.stats.sources}</strong><span>独立来源</span></div><div><strong>{formatNumber(catalog.stats.cards)}</strong><span>分段证据卡</span></div><div><strong>{catalog.stats.dimensions}</strong><span>写作能力维度</span></div><div><strong>100%</strong><span>结构化覆盖</span></div></div><div className="corpus-row"><div><span>武侠小说</span><strong>{catalog.stats.wuxia}</strong></div><div className="bar"><i /></div><div><span>历史相关</span><strong>{catalog.stats.history}</strong></div></div><p className="boundary-note">仅收录结构化摘要、机制统计与电子版定位；不提供原文或长摘录。</p></div>
      </section>
      <section className="boundary-banner"><span>研究边界</span><p>{catalog.notices.historical}</p><p>{catalog.notices.participants}</p></section>
      <section className="section-block" id="combos"><div className="section-heading"><div><span className="section-index">壹</span><p className="eyebrow">SYNTHESIS</p><h2>六种高价值组合</h2></div><p>{catalog.synthesis.conclusion}</p></div><div className="combo-layout"><div className="insight-grid">{catalog.synthesis.combinations.map((item) => <button className={'insight-card ' + (activeCombo.id === item.id ? 'selected' : '')} type="button" onClick={() => setSelectedCombo(item.id)} key={item.id}><span>0{item.id}</span><h3>{item.title.split(' × ')[0]} <b>×</b><br />{item.title.split(' × ')[1]}</h3><small>查看机制与证据</small></button>)}</div><aside className="combo-detail"><p className="eyebrow">COMBINATION 0{activeCombo.id}</p><h3>{activeCombo.title}</h3><p>{activeCombo.body}</p><button type="button" className="quiet-link" onClick={() => setCurrentView('controls')}>拿到控制台里试写 →</button></aside></div></section>
      <section className="ledger-section"><div className="section-heading compact"><div><span className="section-index">贰</span><p className="eyebrow">STATE LEDGER</p><h2>让状态而非事件推进长篇</h2></div><p>{catalog.synthesis.antiInevitability}</p></div><div className="ledger-table">{catalog.synthesis.ledgers.map((row) => <article key={row.layer}><span>{row.layer}</span><p>{row.fields}</p><b>{row.changes}</b></article>)}</div></section>
      <section className="evidence-section"><div><p className="eyebrow">TRACEABLE EVIDENCE</p><h2>从综合洞见回到分段证据</h2><p>每条引用都可直接进入对应来源与电子版定位。</p></div><EvidenceList items={catalog.synthesis.evidence} onOpen={openCard} /></section>
      <section className="relationship-section"><div><p className="eyebrow">EXPLICIT CONTINUITY ONLY</p><h2>只连接明确的谱系</h2><p>其余作品保持独立，只在机制层进行可解释的比较。</p></div><div className="relationship-grid">{catalog.relationships.map((relation) => <article key={relation.id}><span>{relation.title}</span><div className="relationship-path">{relation.sourceIds.map((id, index) => <div key={id}>{index > 0 && <i>→</i>}<button type="button" onClick={() => void openSource(id)}>{getSource(id)?.title}</button></div>)}</div><small>{relation.note}</small></article>)}</div></section>
    </section>}

    {view === 'controls' && <section className="view-content controls-view"><header className="page-heading"><p className="eyebrow">WRITING CONSOLE</p><h1>把洞见变成<br />自己的状态账本。</h1><p>这里提供来自蒸馏成果的原创写作检查框架。所有输入只停留在当前浏览器会话。</p></header><section className="proposition-card"><div><p className="eyebrow">01 · 故事命题</p><h2>一句话约束，比许多设定更有力量。</h2><p>先定义制度位置与不可兼得的义务，再决定情节。</p></div><div className="proposition-form">{([['position', '制度位置'], ['desire', '可见欲望'], ['dutyA', '义务 A'], ['dutyB', '义务 B'], ['consequence', '共同体后果']] as [keyof typeof brief, string][]).map(([key, label]) => <label key={key}>{label}<input value={brief[key]} onChange={(event) => setBrief((state) => ({ ...state, [key]: event.target.value }))} placeholder={'填写' + label} /></label>)}<output>{briefSentence}</output><button type="button" className="primary-action" onClick={copyBrief}>{copied ? '已复制命题' : '复制命题'}</button></div></section><section className="scene-grid"><article><span>前态</span><p>谁想要什么，缺什么，误以为什么？</p></article><article><span>动作</span><p>谁作出带成本的决定？</p></article><article><span>变化</span><p>资源、权限、关系、知识、名誉、价值至少哪一项改变？</p></article><article><span>承诺</span><p>读者知道下一步必须处理的具体事项是什么？</p></article></section><Notice warning>若“变化”为空，这一场多半只是说明或重复气氛。</Notice><section className="control-cards">{catalog.controls.map((control) => <article key={control.numeral}><header><span>{control.numeral}</span><h2>{control.title}</h2></header>{control.intro && <p>{control.intro}</p>}{control.steps.length > 0 && <ol>{control.steps.map((item) => <li key={item}>{item}</li>)}</ol>}{control.bullets.length > 0 && <ul>{control.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}{control.rows.length > 0 && <div className="control-table">{control.rows.map((row, index) => <div key={row[0] + index}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</div>}</article>)}</section><section className="console-notices"><Notice>{catalog.notices.historical}</Notice><Notice>{catalog.notices.evidence}</Notice></section></section>}

    {view === 'sources' && <section className="view-content sources-view"><header className="page-heading split"><div><p className="eyebrow">SOURCE BROWSER</p><h1>二十八个独立来源，<br />不混成一个世界。</h1></div><p>来源按类型、统计指纹与可迁移机制排列。跨书连接仅存在于明确的系列或连续关系中。</p></header><section className="filter-bar" aria-label="来源筛选"><div className="segmented">{(['all', 'wuxia', 'history'] as Group[]).map((item) => <button type="button" className={sourceGroup === item ? 'selected' : ''} onClick={() => setSourceGroup(item)} key={item}>{groupLabel(item)}</button>)}</div><label className="filter-select">来源类型<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="all">全部类型</option>{formats.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label className="filter-input">检索来源<input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="书名、作者、机制" /></label></section><div className="source-browser"><section className="source-list"><p className="list-caption">显示 {filteredSources.length} / {catalog.stats.sources} 个来源</p>{filteredSources.map((source) => <button className={'source-row ' + (selectedSourceId === source.id ? 'selected' : '')} type="button" onClick={() => void openSource(source.id)} key={source.id}><span className={'group-tag ' + source.group}>{source.group === 'wuxia' ? '武侠' : '历史'}</span><span className="source-row-main"><strong>{source.title}</strong><small>{source.author} · {source.descriptor}</small></span><span className="source-row-stats"><b>{source.sections}</b><small>分段</small></span><i>→</i></button>)}</section><section className="source-detail" aria-live="polite">{!selectedSource && <Empty title="选择一部来源" text="查看作品概览、统计指纹、连续性账本与全部分段卡。" />}{selectedSource && !selectedPayload && <div className="loading-state">正在调取《{selectedSource.title}》的结构化档案…</div>}{selectedPayload && <SourceDetail payload={selectedPayload} cards={listedSourceCards} page={sourcePage} pages={sourceCardPages} query={bookCardQuery} onQuery={(value) => { setBookCardQuery(value); setSourcePage(1); }} onPage={setSourcePage} onCard={(card) => { setSelectedCard(card); setCurrentView('cards'); }} />}</section></div></section>}

    {view === 'dimensions' && <section className="view-content dimensions-view"><header className="page-heading split"><div><p className="eyebrow">NINE DIMENSIONS</p><h1>九种能力，<br />都能回到可核对的证据。</h1></div><p>每一维包含核心判断、可执行控制项、常见失效、验收问题及跨来源分段证据。</p></header><div className="dimension-layout"><aside className="dimension-nav" aria-label="能力维度">{catalog.dimensions.map((item, index) => <button type="button" className={selectedDimension === item.slug ? 'selected' : ''} onClick={() => setSelectedDimension(item.slug)} key={item.slug}><span>0{index + 1}</span>{item.title}<i>→</i></button>)}</aside><article className="dimension-detail"><p className="eyebrow">DIMENSION</p><h2>{activeDimension.title}</h2><p className="dimension-judgment">{activeDimension.judgment}</p><div className="dimension-columns"><section><h3>可执行控制项</h3><ol>{activeDimension.controls.map((item) => <li key={item}>{item}</li>)}</ol></section><section><h3>常见失效</h3><ul className="failure-list">{activeDimension.failures.map((item) => <li key={item}>{item}</li>)}</ul><h3>验收问题</h3><ul>{activeDimension.questions.map((item) => <li key={item}>{item}</li>)}</ul></section></div><section className="dimension-evidence"><h3>跨来源证据</h3><EvidenceList items={activeDimension.evidence} onOpen={openCard} /></section></article></div></section>}

    {view === 'cards' && <section className="view-content cards-view"><header className="page-heading split"><div><p className="eyebrow">SECTION CARDS</p><h1>从结构摘要，<br />回到每一张证据卡。</h1></div><p>2,026 条定位卡按需检索和展示。它们保存机制、统计、状态变化和章末承诺，而不替代原作阅读。</p></header><section className="card-filters"><label>检索分段<input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="标题、机制、参与者、承诺" /></label><select value={cardGroup} onChange={(event) => setCardGroup(event.target.value as Group)}><option value="all">全部来源</option><option value="wuxia">武侠小说</option><option value="history">历史相关</option></select><select value={cardMechanism} onChange={(event) => setCardMechanism(event.target.value)}><option value="all">全部机制</option>{mechanisms.map((item) => <option value={item} key={item}>{item}</option>)}</select><select value={cardPromise} onChange={(event) => setCardPromise(event.target.value)}><option value="all">全部承诺</option><option value="open">开放承诺</option><option value="paid-or-partial">已回收 / 部分回收</option><option value="transition">过渡</option></select></section>{!searchItems ? <div className="loading-state">正在准备 {formatNumber(catalog.stats.cards)} 条可检索分段索引…</div> : <div className="card-explorer"><section className="card-results"><p className="list-caption">命中 {cardResults.length}{cardResults.length === 72 ? '+' : ''} 条；仅渲染当前结果。</p>{cardResults.length === 0 && <Empty title="没有匹配的分段卡" text="尝试缩短关键词或清除筛选条件。" />}{cardResults.map((item) => <button type="button" className={'card-row ' + (selectedCard?.id === item.id && selectedCard.sourceId === item.sourceId ? 'selected' : '')} onClick={() => void openCard(item.sourceId, item.id)} key={item.sourceId + item.id}><span>{item.sourceTitle}</span><strong>{item.title}</strong><small>{item.location}</small><em>{item.mechanisms.slice(0, 3).join(' · ')}</em><b>{promiseLabel(item.promise.split(' ')[1] || '')}</b></button>)}</section><section className="card-detail">{selectedCard ? <CardDetail card={selectedCard} source={getSource(selectedCard.sourceId)} onDimension={(slug) => { setSelectedDimension(slug); setCurrentView('dimensions'); }} /> : <Empty title="打开一张分段卡" text="这里将显示前态、因果推进、后态、章末承诺与参与者连续性提示。" />}</section></div>}</section>}

    {searchOpen && <div className="search-overlay" role="presentation" onMouseDown={() => setSearchOpen(false)}><section className="search-dialog" role="dialog" aria-modal="true" aria-label="全局搜索" onMouseDown={(event) => event.stopPropagation()}><header><span>全局搜索</span><button type="button" onClick={() => setSearchOpen(false)}>Esc</button></header><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="检索来源、维度、分段标题、机制或参与者…" />{!term ? <div className="search-empty"><p>输入关键词，即可跨 28 个来源、9 个维度与 2,026 张分段卡检索。</p><div><button type="button" onClick={() => { setSearchOpen(false); setCurrentView('sources'); }}>浏览来源</button><button type="button" onClick={() => { setSearchOpen(false); setCurrentView('dimensions'); }}>查看维度</button><button type="button" onClick={() => { setSearchOpen(false); setCurrentView('cards'); }}>进入分段卡</button></div></div> : <div className="search-results">{quickSources.map((item) => <button type="button" key={item.id} onClick={() => { setSearchOpen(false); void openSource(item.id); }}><small>来源 · {item.format}</small><strong>{item.title}</strong><span>{item.author} · {item.descriptor}</span></button>)}{quickDimensions.map((item) => <button type="button" key={item.slug} onClick={() => { setSelectedDimension(item.slug); setSearchOpen(false); setCurrentView('dimensions'); }}><small>能力维度</small><strong>{item.title}</strong><span>{item.judgment}</span></button>)}{quickCards.map((item) => <button type="button" key={item.sourceId + item.id} onClick={() => { setSearchOpen(false); void openCard(item.sourceId, item.id); }}><small>分段卡 · {item.sourceTitle}</small><strong>{item.title}</strong><span>{item.location} · {item.mechanisms.join('、')}</span></button>)}{quickSources.length + quickDimensions.length + quickCards.length === 0 && <Empty title="没有匹配" text="换一个更短的关键词试试。" />}</div>}</section></div>}
  </main>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span>档</span><h2>{title}</h2><p>{text}</p></div>;
}

function SourceDetail({ payload, cards, page, pages, query, onQuery, onPage, onCard }: { payload: SourcePayload; cards: Card[]; page: number; pages: number; query: string; onQuery: (value: string) => void; onPage: (value: number) => void; onCard: (card: Card) => void }) {
  const { source, ledger } = payload;
  const mechanismMax = Math.max(...ledger.mechanisms.map((item) => item.count), 1);
  const participantMax = Math.max(...ledger.participants.map((item) => item.count), 1);
  return <div className="source-detail-inner"><header className="source-title"><span className={'group-tag ' + source.group}>{source.group === 'wuxia' ? '武侠' : '历史'}</span><h2>{source.title}</h2><p>{source.author} · {source.descriptor}</p></header><div className="source-summary"><p>{source.narrativeCore}</p><blockquote>{source.skeleton}</blockquote></div><div className="source-stats"><div><b>{formatNumber(source.characters)}</b><span>字符</span></div><div><b>{source.sections}</b><span>分段</span></div><div><b>{source.dialogueRatio}%</b><span>对话占比</span></div><div><b>{source.strongEndingRatio}%</b><span>强推进收尾</span></div></div><section className="source-strengths"><h3>可迁移长处</h3><ul>{source.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section><Notice>{source.useLimit}</Notice><section className="ledger-mini"><h3>连续性账本</h3><p>{ledger.relation}</p><div className="ledger-mini-grid"><div><h4>主导场景机制</h4>{ledger.mechanisms.slice(0, 6).map((item) => <MetricBar key={item.name} label={item.name} value={item.count} max={mechanismMax} />)}</div><div><h4>章末承诺</h4>{ledger.promises.map((item) => <MetricBar key={item.name} label={promiseLabel(item.name)} value={item.count} max={source.sections} />)}<h4>高频参与者候选</h4>{ledger.participants.slice(0, 5).map((item) => <MetricBar key={item.name} label={item.name} value={item.count} max={participantMax} />)}</div></div><Notice warning>参与者识别为低到中置信度的导航提示，不能直接视为人物事实。</Notice></section><section className="chapter-list"><header><h3>逐分段卡</h3><label>搜索本书<input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="标题或机制" /></label></header>{cards.map((card) => <button type="button" onClick={() => onCard(card)} key={card.id}><span>{String(card.order).padStart(3, '0')}</span><strong>{card.title}</strong><small>{card.location}</small><em>{card.state.mechanisms.slice(0, 2).join(' · ')}</em><b>{promiseLabel(card.promise.status)}</b></button>)}{cards.length === 0 && <p className="no-cards">没有匹配的本书分段。</p>}<footer><button type="button" disabled={page === 1} onClick={() => onPage(page - 1)}>上一页</button><span>{page} / {pages}</span><button type="button" disabled={page === pages} onClick={() => onPage(page + 1)}>下一页</button></footer></section></div>;
}

function CardDetail({ card, source, onDimension }: { card: Card; source?: Source; onDimension: (slug: string) => void }) {
  return <article className="card-detail-inner"><header><span className="section-number">{String(card.order).padStart(4, '0')}</span><p>{source?.title}</p><h2>{card.title}</h2><small>{card.location}</small></header><div className="metric-cards"><div><b>{formatNumber(card.metrics.characters)}</b><span>字符</span></div><div><b>{card.metrics.sentences}</b><span>句子</span></div><div><b>{card.metrics.paragraphs}</b><span>段落</span></div><div><b>{card.metrics.dialogueRatio}%</b><span>对话</span></div></div><section className="state-flow"><h3>前态 → 因果推进 → 后态</h3><div><article><span>前态</span><p>{card.state.before}</p></article><i>→</i><article><span>推进</span><p>{card.state.action}</p></article><i>→</i><article><span>后态</span><p>{card.state.after}</p></article></div><p className="mechanism-tags">{card.state.mechanisms.map((item) => <span key={item}>{item}</span>)}</p></section><section className="promise-card"><span>章末承诺</span><h3>{promiseLabel(card.promise.status)}</h3><p>{card.promise.note}</p><small>类型：{card.promise.type}</small></section><section className="participants-card"><header><h3>参与者连续性</h3><span>低—中置信度</span></header><p><b>主要候选：</b>{card.participants.primary.length ? card.participants.primary.join('、') : '未可靠识别'}</p><p><b>可能进入：</b>{card.participants.entered.length ? card.participants.entered.join('、') : '无可靠变化'}</p><p><b>可能离开：</b>{card.participants.exited.length ? card.participants.exited.join('、') : '无可靠变化'}</p><Notice warning>规则启发式结果可能混入称谓、地名或动作词；人物连续性必须人工回查。</Notice></section><section className="dimension-links"><h3>可调用维度</h3>{card.dimensions.map((item) => <button type="button" onClick={() => onDimension(item.slug)} key={item.slug}>{item.title} <span>→</span></button>)}</section><footer>分段类型：{card.sectionType} · {card.sectionNote}</footer></article>;
}
