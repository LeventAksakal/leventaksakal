<script setup lang="ts">
defineOptions({ name: 'WorkPage' })
import ProjectAccordion from '@/components/ProjectAccordion.vue'
import { useI18n } from 'vue-i18n'

interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  link?: string;
  repo?: string;
}

interface Position {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  isOngoing: boolean;
  description: string;
  website?: string;
  favicon?: string;
}

import { computed } from 'vue'

const { t, tm } = useI18n()

const positions = computed(() => tm('work.previousPositions.positions') as Position[])
const featuredProjects = computed(() => tm('work.featuredProjects') as Project[])
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="flex-1 pt-20 px-6 pb-6">
      <!-- Main Content Area -->
      <div class="max-w-7xl mx-auto flex flex-col gap-6">
        <!-- Top Row: Current Focus -->
        <div class="flex-shrink-0">
          <div class="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl p-8">
            <div class="prose prose-slate max-w-none">
              <p class="text-slate-800 leading-relaxed text-sm mb-0">
                <span class="font-bold italic">{{ t('work.currentFocus.opener') }} </span>{{
                  t('work.currentFocus.content') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Bottom Row: Previous Positions & Featured Projects -->
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- Left: Previous Positions (1/3 width) -->
          <div class="lg:w-1/3 flex-shrink-0">
            <div
              class="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl p-6 flex flex-col max-h-80 lg:max-h-[420px]">
              <h2 class="text-xl font-bold text-slate-800 mb-4">{{ t('work.previousPositions.title') }}</h2>
              <div class="flex-1 space-y-3 overflow-y-auto scrollbar-hidden">
                <div v-for="(position, index) in positions" :key="index"
                  class="border-l-2 border-slate-300 pl-4 pb-4 last:pb-0">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <img v-if="position.favicon" :src="position.favicon" :alt="`${position.company} logo`"
                        class="w-4 h-4 rounded-sm" onerror="this.style.display='none'">
                      <h3 class="font-semibold text-slate-800">
                        <a v-if="position.website" :href="position.website" target="_blank" rel="noopener noreferrer"
                          class="hover:text-emerald-700 transition-colors duration-200">
                          {{ position.company }}
                        </a>
                        <span v-else>{{ position.company }}</span>
                      </h3>
                    </div>
                  </div>
                  <div class="text-sm text-slate-700 mb-1">{{ position.position }}</div>
                  <div class="text-xs text-slate-600 mb-2">{{ position.startDate }} - {{ position.endDate }}</div>
                  <p class="text-xs text-slate-600 leading-relaxed">{{ position.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Featured Projects (2/3 width) -->
          <div class="lg:w-2/3">
            <div
              class="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl p-6 flex flex-col max-h-80 lg:max-h-[420px]">
              <h2 class="text-xl font-bold text-slate-800 mb-4 text-center">{{ t('work.subtitle') }}</h2>
              <div class="flex-1 overflow-y-auto scrollbar-hidden">
                <ProjectAccordion :projects="featuredProjects" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<style scoped>
.scrollbar-hidden {
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* IE and Edge */
}

.scrollbar-hidden::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari, Opera */
}
</style>
