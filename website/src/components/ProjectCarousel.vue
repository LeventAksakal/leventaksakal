<script setup lang="ts">
interface Project {
  id: number
  title: string
  description: string
  link?: string
  repo?: string
}
const props = defineProps<{ items: Project[] }>()
const emit = defineEmits<{ (e: 'select', project: Project): void }>()
</script>

<template>
  <div class="w-full">
    <el-carousel height="200px" type="card" :autoplay="false" indicator-position="outside" arrow="hover">
      <el-carousel-item v-for="project in props.items" :key="project.id" class="cursor-pointer"
        @click="emit('select', project)">
        <div
          class="h-full bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-6 shadow-lg hover:bg-white/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-center transform hover:-translate-y-1">
          <h3 class="text-lg font-semibold text-slate-800 mb-3 text-center">{{ project.title }}</h3>
          <p class="text-sm text-slate-700 leading-relaxed text-center flex-1 flex items-center justify-center">
            {{ project.description }}
          </p>
          <div class="mt-3 text-xs text-slate-500 italic text-center">
            Click to view project
          </div>
        </div>
      </el-carousel-item>
    </el-carousel>
  </div>
</template>

<style scoped>
/* Custom Element Plus carousel styling for side-by-side cards with minimal overlap */
:deep(.el-carousel__container) {
  height: 200px;
  overflow: visible;
}

:deep(.el-carousel__item) {
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

/* Side cards (non-active) - smaller and slightly faded */
:deep(.el-carousel__item:not(.is-active)) {
  transform: scale(0.9);
  opacity: 0.7;
  z-index: 1;
}

/* Center card (active) - full size and prominent */
:deep(.el-carousel__item.is-active) {
  transform: scale(1);
  opacity: 1;
  z-index: 10;
}

/* Minimal overlap by adjusting card spacing */
:deep(.el-carousel__item) {
  margin: 0 -10px;
}

/* Ensure active card has proper spacing */
:deep(.el-carousel__item.is-active) {
  margin: 0 -5px;
}

:deep(.el-carousel__indicator button) {
  background-color: rgb(148 163 184 / 0.3);
  border-radius: 50%;
}

:deep(.el-carousel__indicator.is-active button) {
  background-color: rgb(148 163 184 / 0.8);
}

:deep(.el-carousel__arrow) {
  background-color: rgb(255 255 255 / 0.2);
  border: 1px solid rgb(255 255 255 / 0.3);
  color: rgb(51 65 85);
}

:deep(.el-carousel__arrow:hover) {
  background-color: rgb(255 255 255 / 0.4);
}
</style>
