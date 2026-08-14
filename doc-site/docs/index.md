# Development blog

This will include writeups on each of the features of UpKeep, as well as some developer insight.

<script setup>
    import { data as posts } from './posts.data.ts'
    import { withBase } from 'vitepress'
</script>

<ul>
    <li v-for="post in posts" :key="post.url">
        <a :href="withBase(post.url)">{{ post.title }}</a> <i> - {{ post.date }}</i>
        <div v-if="post.description" style="margin-top: 0.25em; font-style: italic; font-size: 14px;">{{ post.description }}</div>
    </li>
</ul>
