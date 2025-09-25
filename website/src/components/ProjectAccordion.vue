<script setup lang="ts">
import { ref } from 'vue'
import { Link, FolderOpened } from '@element-plus/icons-vue'

interface Project {
  id: string
  title: string
  description: string
  technologies: string[]
  link?: string
  repo?: string
}

const props = defineProps<{ projects: Project[] }>()

const activeNames = ref<string[]>([])

function openLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="w-full pb-2">
    <el-collapse v-model="activeNames" accordion class="project-accordion">
      <el-collapse-item v-for="project in props.projects" :key="project.id" :name="project.id" class="project-item">
        <template #title>
          <div class="flex items-center justify-between w-full pr-4">
            <span class="font-semibold text-slate-800">{{ project.title }}</span>
            <div class="flex gap-2">
              <el-button v-if="project.link" @click.stop="openLink(project.link)" type="primary" size="small" plain
                class="project-button" :icon="Link">
                Visit
              </el-button>
              <el-button v-if="project.repo" @click.stop="openLink(project.repo)" type="default" size="small" plain
                class="project-button" :icon="FolderOpened">
                Code
              </el-button>
            </div>
          </div>
        </template>

        <div class="project-content px-5 pb-4">
          <p class="text-slate-700 leading-relaxed mb-3 text-sm">
            {{ project.description }}
          </p>

          <div class="flex flex-wrap gap-2">
            <span v-for="tech in project.technologies" :key="tech"
              class="px-2 py-1 bg-emerald-100/80 text-emerald-800 text-xs rounded-full font-medium">
              {{ tech }}
            </span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.project-accordion {
  --el-collapse-header-height: 60px;
  --el-collapse-header-bg-color: transparent;
  --el-collapse-header-text-color: #334155;
  --el-collapse-content-bg-color: transparent;
  border: none;
}

:deep(.el-collapse-item) {
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
  break-inside: avoid;
}

:deep(.el-collapse-item__header) {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  padding: 0 16px;
  border-radius: 12px 12px 0 0;
  transition: background-color 0.3s ease;
  min-height: 56px;
}

:deep(.el-collapse-item__header:hover) {
  background: rgba(255, 255, 255, 0.2);
}

:deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

:deep(.el-collapse-item__content) {
  padding: 0;
  background: transparent;
}

:deep(.el-collapse-item.is-active .el-collapse-item__header) {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px 12px 0 0;
}

.project-button {
  --el-button-hover-bg-color: rgba(255, 255, 255, 0.2);
  --el-button-hover-border-color: rgba(255, 255, 255, 0.3);
}

.project-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>