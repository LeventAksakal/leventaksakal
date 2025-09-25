<script setup lang="ts">
defineOptions({ name: 'AboutPage' })
import avatarPicture from '@/assets/avatar.jpg'
import { useI18n } from 'vue-i18n'
const { t, } = useI18n()
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="flex-1 pt-20 px-6 flex items-center justify-center">
      <div class="flex flex-col lg:flex-row items-center justify-center gap-12 max-w-6xl">
        <!-- Avatar Container -->
        <div class="flex justify-center lg:flex-shrink-0">
          <div class="relative bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl p-1">
            <img :src="avatarPicture" alt="Avatar" class="h-[80vh] w-auto object-cover rounded-xl" />
          </div>
        </div>

        <!-- About Card -->
        <div class="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl p-8 max-w-xl">
          <div class="prose prose-slate max-w-none">
            <p v-for="(paragraph, index) in $tm('about.paragraphs')" :key="index"
              class="text-slate-800 leading-relaxed text-sm mb-4 last:mb-0">
              <span v-if="index === 0" class="font-bold italic">{{ t('about.opener') }} </span>{{ paragraph }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<style scoped>
html {
  scroll-behavior: smooth;
}
</style>
