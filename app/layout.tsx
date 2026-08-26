import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '武史藏经阁｜武侠 × 历史叙事知识库',
  description: '从 28 个独立来源与 2026 张分段卡中提炼原创写作机制。',
  openGraph: {
    title: '武史藏经阁｜武侠 × 历史叙事知识库',
    description: '28 个独立来源、2026 张分段证据卡、9 个写作能力维度。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/og.png', width: 1792, height: 1024, alt: '武史藏经阁：武侠 × 历史叙事知识库' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '武史藏经阁',
    description: '武侠 × 历史叙事知识库',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
