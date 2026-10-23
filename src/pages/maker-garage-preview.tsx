import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import GarageHero from '../components/GarageHero';

export default function MakerGaragePreview(): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const zh = i18n.currentLocale === 'zh-Hans';
  return <Layout
    title={zh ? '赛博创客车库 — 制作预览' : 'Cyber Maker Garage — Preview'}
    description={zh ? '探索为 Peter Pan’s Techland 赛博创客车库制作的真实 3D 资产。' : "Explore the real 3D assets being made for Peter Pan's Techland Cyber Maker Garage."}>
    <main><GarageHero /></main>
  </Layout>;
}
