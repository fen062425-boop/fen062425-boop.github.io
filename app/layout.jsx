import "../styles/globals.css";

const siteUrl = "https://visual-designer-portfolio.fen062425.chatgpt.site";
const title = "Creative E-commerce Director · 设计师作品集";
const description =
  "面向品牌视觉与电商内容的设计师作品集，展示视频创意、详情页设计与首页视觉项目。";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: "/favicon.svg"
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 1024,
        alt: "Creative E-commerce Director 作品集预览"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050607"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
