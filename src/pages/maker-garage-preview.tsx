import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './maker-garage-preview.module.css';

type AssetCounts = {loaded: number; total: number; failed: number};
type PreviewStatus = 'loading' | 'ready' | 'error';

function readCounts(data: unknown): AssetCounts | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  if (message.type !== 'techland-garage-status') return null;
  const {loaded, total, failed} = message;
  if (![loaded, total, failed].every(value =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
  )) return null;
  if ((loaded as number) + (failed as number) > (total as number)) return null;
  return {loaded: loaded as number, total: total as number, failed: failed as number};
}

export default function MakerGaragePreview(): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  const text = (en: string, cn: string) => zh ? cn : en;
  const sceneUrl = useBaseUrl('/maker-garage-preview/scene/');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const [counts, setCounts] = useState<AssetCounts | null>(null);

  useEffect(() => {
    setStatus('loading');
    setCounts(null);
    const timeout = window.setTimeout(() => setStatus('error'), 45000);
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin ||
          event.source !== frameRef.current?.contentWindow) return;
      const next = readCounts(event.data);
      if (!next) return;
      setCounts(next);
      if (next.loaded > 0) {
        window.clearTimeout(timeout);
        setStatus('ready');
      } else if (next.total > 0 && next.failed === next.total) {
        window.clearTimeout(timeout);
        setStatus('error');
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, [attempt]);

  const reload = () => setAttempt(value => value + 1);
  const statusText = status === 'error'
    ? text('Preview unavailable', '预览暂不可用')
    : status === 'loading'
      ? text('Opening the garage…', '正在打开车库…')
      : text('LIVE PREVIEW', '交互预览');
  const loadingDescription = counts && counts.total > 0
    ? text(`${counts.loaded} of ${counts.total} assets loaded.`, `已载入 ${counts.loaded} / ${counts.total} 个资产。`)
    : statusText;
  const destinations = [
    {to: '/docs/projects', en: 'Projects', zh: '项目作品'},
    {to: '/blog', en: 'Blog', zh: '科技日记'},
    {to: '/challenge', en: 'Challenge', zh: '创客挑战'},
    {to: '/docs/guides', en: 'Guides', zh: '技术指南'},
    {to: '/docs/about', en: 'About Peter', zh: '认识彼得潘'},
  ];

  return (
    <Layout
      title={text('Cyber Maker Garage — Preview', '赛博创客车库 — 制作预览')}
      description={text(
        "Explore the real 3D assets being made for Peter Pan's Techland Cyber Maker Garage.",
        '探索为 Peter Pan’s Techland 赛博创客车库制作的真实 3D 资产。',
      )}>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="garage-headline">
          <header className={styles.heroCopy}>
            <p className={styles.eyebrow}>{text('A MAKER’S PLAYGROUND IN SHENZHEN', '深圳 · 创客的游乐场')}</p>
            <h1 id="garage-headline" className={styles.headline} aria-label="MADE OF IDEAS. BUILT BY HAND.">
              <span>MADE OF</span>{' '}
              <strong>IDEAS.</strong>{' '}
              <span className={styles.headlineLast}>BUILT BY HAND.</span>
            </h1>
            <p className={styles.intro}>{text(
              'A cyber maker garage. Robots, tools, and everyday experiments. Same world. More to build.',
              '把想法造出来。机器人、电子工具和日常创客实验，都从这里开始。',
            )}</p>
            <div className={styles.actions}>
              <a className={styles.primaryAction} href="#garage-scene">
                <span aria-hidden="true">↗</span>{text('ENTER THE GARAGE', '走进车库')}
              </a>
              <Link className={styles.secondaryAction} to="/blog">
                {text('READ THE BLOG', '阅读科技日记')}<span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className={styles.previewLabel}>
              <span className={styles.signal} aria-hidden="true" />
              CYBER MAKER GARAGE <span aria-hidden="true">/</span> {text('PREVIEW', '制作预览')}
            </p>
          </header>

          <section className={styles.viewer} aria-label={text('Interactive garage preview', '交互式车库预览')}>
            <div className={styles.stage}>
              <iframe
                id="garage-scene"
                key={attempt}
                ref={frameRef}
                className={styles.frame}
                src={`${sceneUrl}?lang=${encodeURIComponent(i18n.currentLocale)}&embedded=1&v=interior-v1`}
                title={text('Cyber Maker Garage 3D scene', '赛博创客车库 3D 场景')}
                aria-describedby="garage-controls"
                loading="eager"
                allowFullScreen
                onError={() => setStatus('error')}
              />
              {status === 'loading' && (
                <div className={styles.loading} role="status">
                  <span className={styles.loadingGlyph} aria-hidden="true" />
                  <strong>{text('Opening the garage', '正在打开车库')}</strong>
                  <p>{text('A few things are taking their places.', '让每一件作品就位。')}</p>
                </div>
              )}
              {status === 'error' && (
                <div className={styles.errorCard} role="alert">
                  <span className={styles.errorLabel}>{text('PREVIEW UNAVAILABLE', '预览暂时不可用')}</span>
                  <h2>{text('Let’s try opening it again.', '再试一次，打开车库。')}</h2>
                  <p>{text(
                    'Reload the scene, or explore the projects and stories below.',
                    '可以重新载入，也可以通过下方入口继续探索作品与故事。',
                  )}</p>
                  <button type="button" onClick={reload} className={styles.primaryButton}>
                    {text('Try again', '重新载入')} <span aria-hidden="true">↻</span>
                  </button>
                </div>
              )}
            </div>
            <div className={styles.viewerTools}>
              <div className={styles.status} title={loadingDescription}>
                <span className={`${styles.statusDot} ${status === 'ready' ? styles.statusReady : ''} ${status === 'error' ? styles.statusError : ''}`} aria-hidden="true" />
                <span>{statusText}</span>
              </div>
              <button type="button" onClick={reload} className={styles.reloadButton}
                title={text('Reload preview', '刷新预览')} aria-label={text('Reload preview', '刷新预览')}>↻</button>
            </div>
            <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
              {loadingDescription}
              {counts && counts.failed > 0 && text(` ${counts.failed} assets unavailable.`, ` ${counts.failed} 项暂不可用。`)}
            </span>
          </section>

          <p id="garage-controls" className={styles.interactionHint}>
            <span aria-hidden="true">↔</span>
            {text('Drag to explore. Scroll or pinch to zoom.', '拖动环顾，滚轮或双指缩放。')}
            <span className={styles.assetHint}>
              {text('Open “Assets” in the scene for production status.', '打开场景内的「资产清单」查看制作状态。')}
            </span>
          </p>
        </section>
        <nav className={styles.destinations} aria-label={text('Explore Techland', '探索科技谷')}>
          <p>{text('SAME WORLD. MORE TO BUILD.', '同一个世界，还有更多值得造。')}</p>
          <div className={styles.destinationLinks}>
            {destinations.map(destination => (
              <Link key={destination.to} to={destination.to} className={styles.destination}>
                {zh ? destination.zh : destination.en}<span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </nav>
      </main>
    </Layout>
  );
}
