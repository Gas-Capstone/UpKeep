import { createContentLoader } from "vitepress";

export default createContentLoader("/posts/*.md", {
  excerpt: true,
  transform(raw) {
    return raw
      .sort(
        (a, b) => +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date),
      )
      .map((page) => ({
        title: page.frontmatter.title,
        date: formatDate(page.frontmatter.date),
        description: page.frontmatter.description,
        url: page.url,
      }));
  },
});

function formatDate(raw: string | Date) {
  return new Date(raw).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
