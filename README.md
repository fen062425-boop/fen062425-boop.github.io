# 响应式设计师作品集

这是一个参考深色沉浸式作品集结构重新设计的单页网站，适配桌面端与手机端。

## 本地运行

```powershell
pnpm.cmd install
pnpm.cmd dev
```

浏览器打开终端输出的本地地址。

生产构建：

```powershell
pnpm.cmd build
pnpm.cmd start
```

## 修改内容

主要文案、能力、服务、联系方式和项目数据集中在：

```text
data/portfolio.js
```

项目封面当前由 `pages/index.jsx` 中的 `ProjectArtwork` 组件与 `styles/globals.css` 生成，不依赖外部图片。

替换成真实作品时，可以：

1. 将图片放入 `public/assets/`。
2. 在项目数据中增加图片路径。
3. 将对应的 `ProjectArtwork` 改为图片标签，或保留现有图形作为加载占位。

## 页面结构

- 首屏视觉与定位
- 个人介绍与能力范围
- 分类作品网格
- 项目详情弹窗
- 服务内容
- 联系方式

## 技术说明

- React
- vinext
- 原生 CSS
- 无 UI 框架、数据库或外部图片依赖
