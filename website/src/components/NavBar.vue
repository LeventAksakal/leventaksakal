<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t, locale } = useI18n()

interface NavItem { to: string; key: string }
const navItems: NavItem[] = [
  { to: '/', key: 'nav.about' },
  { to: '/work', key: 'nav.work' },
]

function isActive(path: string) {
  return route.path === path
}

function toggleLanguage() {
  locale.value = locale.value === 'en' ? 'tr' : 'en'
}

function linkClasses(path: string) {
  const base = 'px-2 pb-1 pt-1 text-sm font-medium tracking-wide border-b-2 transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/30'
  if (isActive(path)) {
    return base + ' border-emerald-600 text-emerald-800'
  }
  return base + ' border-transparent text-slate-700 hover:text-emerald-800 hover:border-emerald-500/40'
}
</script>

<template>
  <nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-white/20 border-b border-white/30">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <!-- Left: Name + divider + nav items -->
      <div class="flex items-center gap-6 min-w-0">
        <div class="font-semibold tracking-wide text-slate-800 text-base select-none whitespace-nowrap">
          {{ t('common.name') }}
        </div>
        <div class="h-5 w-px bg-slate-300/60"></div>
        <div class="flex items-center gap-6 flex-wrap">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" :class="linkClasses(item.to)">
            {{ t(item.key) }}
          </RouterLink>
        </div>
      </div>
      <!-- Right: Language -->
      <div class="flex items-center">
        <button @click="toggleLanguage"
          class="px-3 py-2 text-xs font-semibold rounded-md text-slate-700 hover:text-emerald-800 hover:bg-white/10 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/30">
          {{ locale.toUpperCase() }}
        </button>
      </div>
    </div>
  </nav>
</template>
