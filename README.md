# 响应式设计师作品集

这是一个面向桌面端与手机端的单页设计师作品集。页面采用深色沉浸式视觉，包括全屏首屏、个人简介、分类作品网格、项目预览灯箱与联系区。

## 本地运行

```powershell
pnpm.cmd install
pnpm.cmd dev
```

生产构建与预览：

```powershell
pnpm.cmd build
pnpm.cmd start
```

## 内容维护

网站名称、个人介绍、经历、联系方式、作品分类与项目数据集中在：

```text
data/portfolio.js
```

当前作品封面和人物图为可直接运行的原创 CSS 概念占位视觉，不包含参考网站的原始图片或视频。替换真实作品时：

1. 将图片或视频放入 `public/assets/`。
2. 在 `data/portfolio.js` 中补充对应资源路径。
3. 在 `app/page.jsx` 的作品组件中读取资源路径，并保留现有占位视觉作为加载后备。

## 页面结构

- 固定胶囊导航
- 全屏沉浸式主视觉
- 个人简介、经历与能力数据
- 视频创意、详情页设计、首页视觉三个作品分组
- 分类筛选与项目灯箱
- 联系方式

## 技术

- React
- vinext
- 原生 CSS
- Cloudflare Worker 兼容构建
