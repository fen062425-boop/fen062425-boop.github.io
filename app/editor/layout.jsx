import "../../styles/editor.css";

export const metadata = {
  title: "作品集本地编辑器",
  description: "在当前浏览器中可视化修改并预览作品集内容。",
  robots: {
    index: false,
    follow: false
  }
};

export default function EditorLayout({ children }) {
  return children;
}
