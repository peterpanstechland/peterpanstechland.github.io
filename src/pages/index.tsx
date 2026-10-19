import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';

type ToolId = 'bench' | 'printer' | 'laser' | 'pnp' | 'solder' | 'hotair' | 'microscope' | 'scope';
type SceneMessage = {channel?: string; type?: string; id?: ToolId};
const tools: {id: ToolId; en: string; zh: string; enDesc: string; zhDesc: string}[] = [
  {id: 'bench', en: 'Workbench', zh: '主工作台', enDesc: 'The place where ideas get tested, broken, fixed and turned into prototypes.', zhDesc: '从想法到实物，焊接、写代码、调试和反复折腾的起点。'},
  {id: 'printer', en: '3D Printer', zh: '3D 打印', enDesc: 'From CAD sketches to enclosures, fixtures and strange mechanical parts.', zhDesc: '把 CAD 草图变成外壳、夹具和奇妙的机械结构。'},
  {id: 'laser', en: 'Laser Cutter', zh: '激光切割', enDesc: 'Cut acrylic, wood and panels to bring new ideas to life.', zhDesc: '切割亚克力、木板和面板，快速验证结构设计。'},
  {id: 'pnp', en: 'Pick & Place', zh: '贴片设备', enDesc: 'The tiny production line behind actual functioning PCBs.', zhDesc: '让一块 PCB 真正变成可以运行的电子模块。'},
  {id: 'solder', en: 'Soldering', zh: '焊接工位', enDesc: 'Where electronic projects come alive, one joint at a time.', zhDesc: '一颗元件、一个焊点，把电子项目一点点做出来。'},
  {id: 'hotair', en: 'Hot Air', zh: '热风返修', enDesc: 'Repairs, rework and another chance for an unhappy circuit.', zhDesc: '器件返修、热缩处理，让翻车电路再抢救一下。'},
  {id: 'microscope', en: 'Microscope', zh: '显微镜', enDesc: 'Get closer to the details of a stubborn board.', zhDesc: '放大观察那些肉眼看不到的焊点和问题。'},
  {id: 'scope', en: 'Oscilloscope', zh: '示波器', enDesc: 'Explore the signals and timing hidden beneath the circuit.', zhDesc: '把看不见的信号、噪声和时序错误找出来。'},
];

export default function Home(): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<ToolId>('bench');
  const selectedTool = tools.find(t => t.id === selected) ?? tools[0];
  const send = (action: 'focus' | 'reset', id?: ToolId) => {
    frameRef.current?.contentWindow?.postMessage({channel: 'techland-maker-house', action, id}, window.location.origin);
  };
  useEffect(() => {
    const onMessage = (event: MessageEvent<SceneMessage>) => {
      if (event.origin !== window.location.origin || event.data?.channel !== 'techland-maker-house') return;
      if (event.data.type === 'ready') setReady(true);
      if (event.data.type === 'tool' && tools.some(t => t.id === event.data.id)) setSelected(event.data.id as ToolId);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const focus = (id: ToolId) => {setSelected(id); send('focus', id);};
  return (
    <Layout
      title={zh ? '彼得潘的科技谷 · Maker Lab' : 'Maker Lab · Peter Pan’s Techland'}
      description={zh
        ? 'Peter Pan 的个人技术博客：AI、机器人、开源硬件、交互装置与 Maker 实验。'
        : 'Maker notes, creative hardware, robotics and AI experiments by Peter Pan.'}>
      <main className={styles.home}>
        <div className={styles.topRule} aria-hidden="true" />
        <section className={styles.hero}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}><span className={styles.pulse} /> PETER PAN'S TECHLAND <span className={styles.eyebrowSep}>/</span> THE MAKER LAB</p>
            <h1 className={styles.headline}>
              {zh ? <>把脑洞，<span>做成真的。</span></> : <>Make ideas <span>real.</span></>}
            </h1>
            <p className={styles.lead}>
              {zh
                ? '这里是彼得潘的科技谷。一间关于 AI、机器人、开源硬件和奇怪发明的实验室。'
                : 'A personal lab for AI, robots, open hardware, and wonderfully unconventional inventions.'}
            </p>
            <p className={styles.supporting}>
              {zh
                ? '不只展示结果，也分享从灵感、踩坑到最终 Demo 的全过程。'
                : 'From the first sketch to the messy prototype — I share the process, not just the result.'}
            </p>
            <div className={styles.ctas}>
              <Link className={styles.primaryCta} to="/docs/projects">{zh ? '探索我的项目' : 'Explore Projects'} <span aria-hidden="true">↗</span></Link>
              <Link className={styles.secondaryCta} to="/blog">{zh ? '阅读技术博客' : 'Read the Blog'} <span aria-hidden="true">→</span></Link>
            </div>
            <div className={styles.miniLine}><span>AI + HARDWARE</span><span>ROBOTICS</span><span>MAKE & SHARE</span></div>
          </div>
          <div className={styles.studioCard}>
            <div className={styles.studioHeader}>
              <span><span className={styles.headerDot} /> MAKER HOUSE <small>/ INTERACTIVE MODEL</small></span>
              <button type="button" className={styles.resetButton} onClick={() => {setSelected('bench');send('reset');}}>{zh ? '重置视角' : 'Reset view'} ↺</button>
            </div>
            <div className={styles.modelViewport}>
              <div className={styles.modelFallback} aria-hidden="true">MAKER HOUSE <span>● ● ●</span></div>
              <iframe ref={frameRef} className={styles.scene} src="/maker-house/scene.html"
                title={zh ? '可互动的 3D 创客实验室模型' : 'Interactive 3D maker lab model'} loading="eager" />
              <div className={styles.modelHint}>{ready ? (zh ? '拖动旋转 · 点击设备' : 'Drag to orbit · Click an object') : (zh ? '模型加载中 / 可继续浏览' : 'Loading model / Site is ready')}</div>
            </div>
            <div className={styles.toolInfo} aria-live="polite">
              <span className={styles.toolLabel}>ON THE WORKBENCH <span className={styles.toolCount}>{String(tools.findIndex(t => t.id === selected) + 1).padStart(2, '0')} / 08</span></span>
              <div className={styles.toolText}><h2>{zh ? selectedTool.zh : selectedTool.en}</h2><p>{zh ? selectedTool.zhDesc : selectedTool.enDesc}</p></div>
              <div className={styles.toolPicker} aria-label={zh ? '选择工作室设备' : 'Select equipment'}>
                {tools.map(t => <button key={t.id} type="button" onClick={() => focus(t.id)}
                  aria-pressed={selected === t.id} className={selected === t.id ? styles.toolActive : styles.toolChip}>
                  {zh ? t.zh : t.en}
                </button>)}
              </div>
            </div>
          </div>
        </section>
        <section className={styles.explore} aria-labelledby="explore-heading">
          <div className={styles.sectionTitle}>
            <div><p>EXPLORE THE TECHLAND / 01 — 04</p><h2 id="explore-heading">{zh ? '从这里开始探索' : 'Find your next rabbit hole.'}</h2></div>
            <span>{zh ? '边折腾，边记录。' : 'Build. Break. Learn. Repeat.'}</span>
          </div>
          <div className={styles.linksGrid}>
            <Link to="/docs/projects" className={styles.linkCard}><span>01 / BUILD</span><strong>{zh ? '项目作品' : 'Projects'}</strong><p>{zh ? 'AIoT、机器人与交互装置' : 'Robots, AIoT and interactive builds'}</p><b aria-hidden="true">↗</b></Link>
            <Link to="/docs/guides" className={styles.linkCard}><span>02 / LEARN</span><strong>{zh ? '技术笔记' : 'Guides'}</strong><p>{zh ? '硬件、代码与踩坑笔记' : 'Hardware notes and practical tutorials'}</p><b aria-hidden="true">↗</b></Link>
            <Link to="/challenge" className={styles.linkCard}><span>03 / CONNECT</span><strong>Maker Challenge</strong><p>{zh ? '化缘、造物、现场 Demo' : 'BEG. BUILD. SHOW.'}</p><b aria-hidden="true">↗</b></Link>
            <Link to="/blog" className={styles.linkCard}><span>04 / STORIES</span><strong>{zh ? '科技日记' : 'Journal'}</strong><p>{zh ? '创客文化与有趣的新想法' : 'Maker culture, stories and experiments'}</p><b aria-hidden="true">↗</b></Link>
          </div>
        </section>
        <div className={styles.bottomLine}><span>TECHNOLOGY IGNITES THE SOUL OF MACHINES.</span><Link to="/docs/about">{zh ? '关于 Peter Pan ↗' : 'About Peter Pan ↗'}</Link></div>
      </main>
    </Layout>
  );
}
