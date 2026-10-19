import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

type ToolId = 'bench' | 'printer' | 'laser' | 'pnp' | 'solder' | 'hotair' | 'microscope' | 'scope';
type SceneAction = 'enter' | 'exit' | 'billboard' | 'focus';
type SceneMessage = {channel?: string; type?: string; id?: string};
const tools: {id: ToolId; en: string; zh: string; detailEn: string; detailZh: string; icon: string}[] = [
  {id:'bench',en:"Peter's Workbench",zh:'彼得潘的工作台',detailEn:'The command center for vibe coding, circuit debugging, and last-minute prototypes.',detailZh:'Vibe Coding、电路调试和凌晨赶 Demo 的指挥中心。',icon:'⌘'},
  {id:'printer',en:'3D Printer',zh:'3D 打印机',detailEn:'From a rough CAD idea to an actual fixture, enclosure or mechanical part.',detailZh:'把天马行空的 CAD 想法变成夹具、外壳和机械结构。',icon:'▣'},
  {id:'laser',en:'Laser Cutter',zh:'激光切割机',detailEn:'Fast iteration on panels, acrylic, plywood and weird experimental enclosures.',detailZh:'快速切割面板、亚克力、板材，以及奇怪的实验外壳。',icon:'✳'},
  {id:'pnp',en:'Pick & Place',zh:'贴片机',detailEn:'A miniature electronics production line for assembled PCBs.',detailZh:'把 PCB 从裸板推进到实际可用的电子模块。',icon:'▦'},
  {id:'solder',en:'Soldering Station',zh:'焊台',detailEn:'Where most hardware ideas either come alive or release the magic smoke.',detailZh:'让电子脑洞活过来，或者意外释放魔法烟雾的地方。',icon:'⌁'},
  {id:'hotair',en:'Hot Air Rework',zh:'热风枪',detailEn:'Component rework, heat-shrink and precise repair sessions.',detailZh:'芯片返修、热缩管和各种精细返工。',icon:'♨'},
  {id:'microscope',en:'Microscope',zh:'显微镜',detailEn:'Inspect tiny solder joints and the evidence behind mysterious failures.',detailZh:'观察细小焊点，寻找神秘故障背后的蛛丝马迹。',icon:'◎'},
  {id:'scope',en:'Oscilloscope',zh:'示波器',detailEn:'Chase waveforms, timing glitches and signals hiding in plain sight.',detailZh:'追踪波形、时序错误和藏在电路里的秘密。',icon:'〰'},
];
const navigation = [
  {name:'Start Here',to:'/docs/start-here/intro',icon:'↗'},
  {name:'Projects',to:'/docs/projects',icon:'↗'},
  {name:'Guides',to:'/docs/guides',icon:'↗'},
  {name:'Workshops',to:'/docs/workshops',icon:'↗'},
  {name:'Hackathons',to:'/docs/hackathons',icon:'↗'},
  {name:'Challenge',to:'/challenge',icon:'↗'},
  {name:'Community',to:'/docs/community',icon:'↗'},
  {name:'Blog',to:'/blog',icon:'↗'},
];
export default function Home(): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [entered,setEntered] = useState(false);
  const [selected,setSelected] = useState<ToolId>('bench');
  const [billboard,setBillboard] = useState(false);
  const [ready,setReady] = useState(false);
  const selectedTool = tools.find(t => t.id === selected) ?? tools[0];
  const send = (action: SceneAction, id?: string) => {
    if (typeof window !== 'undefined') frameRef.current?.contentWindow?.postMessage(
      {channel:'techland-maker-house',action,id},window.location.origin
    );
  };
  useEffect(() => {
    const onMessage = (event: MessageEvent<SceneMessage>) => {
      if (event.origin !== window.location.origin || event.data?.channel !== 'techland-maker-house') return;
      if (event.data.type === 'ready') setReady(true);
      if (event.data.type === 'enter') setEntered(true);
      if (event.data.type === 'exit') setEntered(false);
      if (event.data.type === 'billboard') setBillboard(true);
      if (event.data.type === 'tool' && tools.some(t => t.id === event.data.id)) {
        setSelected(event.data.id as ToolId);
        setEntered(true);
      }
    };
    window.addEventListener('message',onMessage);
    return () => window.removeEventListener('message',onMessage);
  },[]);
  const enter = () => {setEntered(true); send('enter');};
  const exit = () => {setEntered(false); send('exit');};
  const focus = (id: ToolId) => {setSelected(id);setEntered(true);send('focus',id);};
  return <Layout
    title={zh ? '彼得潘的科技谷 · 创客实验室' : 'Maker House · Build the Soul of Machines'}
    description={zh ? '探索彼得潘的 3D 创客实验室：AI、机器人、电子硬件、3D 打印与技术博客。' : "Explore Peter Pan's interactive maker house, projects, tools, AI, hardware guides and blog."}>
    <main className={styles.home}>
      <section className={styles.experience} aria-label={zh?'3D 创客实验室':'3D maker house'}>
        <div className={styles.scanlines} aria-hidden="true" />
        <div className={styles.sceneWrap}>
          <iframe ref={frameRef} className={styles.sceneFrame} title={zh?'3D 创客之家互动场景':'Interactive 3D Maker House'}
            src="/maker-house/scene.html" loading="eager" allow="fullscreen" />
        </div>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}><span className={styles.liveDot} /> PETER PAN'S TECHLAND <span className={styles.divider}>/</span> 001: MAKER HOUSE</div>
          <p className={styles.overline}>AI × HARDWARE × OPEN SOURCE × CHAOS</p>
          <h1 className={styles.headline}>{zh?'给机器': 'BUILD THE'}<span>{zh?'注入灵魂。':'SOUL OF MACHINES.'}</span></h1>
          <p className={styles.lead}>{zh?'欢迎来到彼得潘的科技谷。一间把 AI、机器人、开源硬件和稀奇古怪的脑洞焊在一起的创客实验室。':"Welcome to my maker house — where AI, robots, open hardware and delightfully ridiculous ideas turn into working things."}</p>
          <div className={styles.actions}>
            <button className={styles.mainButton} type="button" onClick={entered ? exit : enter}>{entered?(zh?'← 退出工作室':'← EXIT WORKSHOP'):(zh?'进入工作室 ↗':'ENTER THE WORKSHOP ↗')}</button>
            <button className={styles.outlineButton} type="button" onClick={()=>{setBillboard(true);send('billboard');}}>{zh?'探索导航板':'EXPLORE THE BILLBOARD'} <span aria-hidden="true">⌗</span></button>
          </div>
          <p className={styles.hint}>{zh?'↳ 点击场景中的设备或导航牌，拖动旋转视角；也可以使用下方设备按钮。':'↳ Click equipment or the sign, drag to orbit, or use the tool buttons below.'}</p>
        </div>
        <div className={styles.sceneStatus}><span className={styles.liveDot}/>{ready ? (entered ? 'INTERIOR MODE' : 'HOUSE VIEW') : 'LOADING / 3D'}</div>
        <div className={styles.coordinates} aria-hidden="true">TECHLAND://SHENZHEN<br/>MAKER MODE // ON</div>
        <aside className={styles.toolPanel} aria-label={zh?'工作室设备':'Workshop tools'}>
          <div className={styles.panelHeader}><span>TOOL INSPECTOR</span><span className={styles.indexNo}>0{tools.findIndex(t=>t.id===selected)+1} / 08</span></div>
          <div className={styles.toolHeading}><span className={styles.toolGlyph}>{selectedTool.icon}</span><div><h2>{zh?selectedTool.zh:selectedTool.en}</h2><p>{zh?selectedTool.detailZh:selectedTool.detailEn}</p></div></div>
          <div className={styles.toolSwitcher}>{tools.map(t=><button key={t.id} className={t.id===selected?styles.toolActive:styles.toolButton} title={zh?t.zh:t.en} type="button" onClick={()=>focus(t.id)}>{t.icon}<span className={styles.visuallyHidden}>{zh?t.zh:t.en}</span></button>)}</div>
          <Link className={styles.learnLink} to="/docs/guides">{zh?'进入技术指南 →':'EXPLORE THE GUIDES →'}</Link>
        </aside>
        {billboard && <div className={styles.billboardBackdrop} onClick={()=>setBillboard(false)}>
          <section role="dialog" aria-modal="true" aria-label={zh?'工作室导航牌':'Maker house navigation'} className={styles.billboardPanel} onClick={event=>event.stopPropagation()}>
            <div className={styles.boardHeader}><div><span>WAYFINDING / TECHLAND</span><h2>{zh?'探索我的科技世界':'CHOOSE YOUR PORTAL'}</h2></div><button type="button" aria-label="Close" className={styles.closeButton} onClick={()=>setBillboard(false)}>×</button></div>
            <div className={styles.boardLinks}>{navigation.map(item=><Link key={item.to} to={item.to} onClick={()=>setBillboard(false)}>{item.name}<span>{item.icon}</span></Link>)}</div>
            <p>{zh?'真实的笔记、未完成的实验和一些快乐的电子垃圾。':'Real projects, unfinished experiments, and a healthy amount of electronic chaos.'}</p>
          </section>
        </div>}
      </section>
      <section className={styles.afterHouse}>
        <div className={styles.sectionIntro}><p>WHAT'S INSIDE / 002</p><h2>{zh?'一边造物，一边记录':'BUILD THINGS. SHARE THE PROCESS.'}</h2></div>
        <div className={styles.portalGrid}>
          <Link to="/docs/projects" className={styles.portal}><span>01 / LAB</span><strong>{zh?'项目档案':'PROJECT ARCHIVE'}</strong><p>{zh?'机器人、AIoT、互动装置，记录能跑和跑不起来的尝试。':'Robots, AIoT and interactive hardware experiments.'}</p><b>↗</b></Link>
          <Link to="/docs/guides" className={styles.portal}><span>02 / LEARN</span><strong>{zh?'技术与教程':'GUIDES & NOTES'}</strong><p>{zh?'从原理到接线再到部署，能复用才是真的学会。':'Practical notes, code and repeatable build workflows.'}</p><b>↗</b></Link>
          <Link to="/challenge" className={styles.portal}><span>03 / MAKE</span><strong>MAKER CHALLENGE</strong><p>{zh?'BEG. BUILD. SHOW. 从展位化缘零件，现场造一个 Demo。':'BEG. BUILD. SHOW. From donated components to a live demo.'}</p><b>↗</b></Link>
          <Link to="/blog" className={styles.portal}><span>04 / THOUGHTS</span><strong>{zh?'彼得潘的科技日记':'TECHLAND JOURNAL'}</strong><p>{zh?'脑洞、黑客松、社区与跨界 Maker 的日常。':'Maker culture, hackathons and ideas that refuse to sit still.'}</p><b>↗</b></Link>
        </div>
        <div className={styles.footerLine}><span>TECHNOLOGY IGNITES THE SOUL OF MACHINES.</span><Link to="/docs/about">{zh?'认识 Peter Pan ↗':'ABOUT THE MAKER ↗'}</Link></div>
      </section>
    </main>
  </Layout>;
}
