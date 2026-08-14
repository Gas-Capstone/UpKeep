import { defineConfig } from "vitepress";

export default defineConfig({
  srcDir: "docs",
  title: "UpKeep",
  description: "Development blog for UpKeep",
  base: "/UpKeep/",
  vite: {
    css: {
      postcss: {
        plugins: [],
      },
    },
  },
  themeConfig: {
    nav: [
      { text: "Development blog", link: "/" },
    ],
    sidebar: [
        {
          text: "Development blog",
          items: [
            { text: "Index", link: "/" },
            { text: "July 27, 2026", link: "/posts/07-27-2026/"},
            { text: "August 14, 2026", link: "/posts/08-14-2026"}
          ],
        },
      ],
    socialLinks: [
      { icon: "github", link: "https://github.com/Gas-Capstone/UpKeep" },
    ],
  },
});
