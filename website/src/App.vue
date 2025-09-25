<script setup lang="ts">
import { ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useBackgroundRotator } from '@/composables/useBackgroundRotator'

// Use Vite's glob import to get background JPG files (bg-*.jpg pattern)
const bgImageModules = import.meta.glob('@/assets/bg-*.jpg', { eager: true, as: 'url' })

// Create ref for the main app container
const appContainerRef = ref<HTMLElement | null>(null)

// Convert glob import to array of image URLs
const backgroundImages = Object.values(bgImageModules) as string[]

// Initialize background rotator (auto-starts on mount)
useBackgroundRotator(appContainerRef, {
  images: backgroundImages,
  intervalMs: 8000, // Change background every 8 seconds
  enableTransition: true,
  transitionDuration: 1500 // 1.5 second transition
})
</script>

<template>
  <div ref="appContainerRef" class="min-h-screen transition-all duration-1500 ease-in-out relative">
    <!-- Blur overlay for consistent page styling -->
    <div class="fixed inset-0 backdrop-blur-sm bg-white/30 z-0"></div>

    <!-- Main content with proper z-index -->
    <div class="relative z-10">
      <NavBar />
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
/* Ensure smooth background transitions */
div[ref="appContainerRef"] {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
}
</style>
