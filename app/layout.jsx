import "../styles/globals.css";

const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER ?? "";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const githubBasePath =
  repositoryOwner &&
  repositoryName &&
  repositoryName !== `${repositoryOwner}.github.io`
    ? `/${repositoryName}`
    : "";
const siteUrl =
  repositoryOwner && repositoryName
    ? `https://${repositoryOwner}.github.io${githubBasePath}`
    : "https://visual-designer-portfolio.fen062425.chatgpt.site";
const publicAssetUrl = (path) => `${githubBasePath}${path}`;
const title = "Creative E-commerce Director · 设计师作品集";
const description =
  "面向品牌视觉与电商内容的设计师作品集，展示视频创意、详情页设计与首页视觉项目。";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: publicAssetUrl("/favicon.svg")
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: siteUrl,
    images: [
      {
        url: publicAssetUrl("/og.png"),
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
    images: [publicAssetUrl("/og.png")]
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
