<script setup lang="ts">
interface BlogMeta {
    slug: string
    title: string
    date: string
    topic: string
    excerpt: string
}
const props = defineProps<{ post: BlogMeta }>()
const emit = defineEmits<{ (e: 'open', slug: string): void }>()
</script>

<template>
    <article
        class="bg-white/80 border border-emerald-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer"
        @click="emit('open', props.post.slug)">
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs uppercase tracking-wide text-emerald-600 font-semibold">{{ props.post.topic }}</span>
            <time class="text-xs text-emerald-700/60">{{ props.post.date }}</time>
        </div>
        <h3 class="text-lg font-semibold text-emerald-700 mb-2">{{ props.post.title }}</h3>
        <p class="text-sm text-emerald-700/80 leading-relaxed line-clamp-3">
            {{ props.post.excerpt }}
        </p>
        <div class="mt-3 text-emerald-600 text-xs font-medium">
            Read more →
        </div>
    </article>
</template>
