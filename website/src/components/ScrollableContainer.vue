<script setup lang="ts">
interface ScrollableContainerProps {
  maxHeight?: string
  showScrollbar?: boolean
}

const props = withDefaults(defineProps<ScrollableContainerProps>(), {
  maxHeight: 'calc(100vh - 12rem)', // Default: viewport height minus navbar and padding
  showScrollbar: false
})
</script>

<template>
  <div class="overflow-y-auto transition-all duration-300" :class="{
    'scrollbar-hide': !props.showScrollbar,
    'scrollbar-thin': props.showScrollbar
  }" :style="{ maxHeight: props.maxHeight }">
    <slot />
  </div>
</template>

<style scoped>
/* Hide scrollbar for webkit browsers */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.scrollbar-hide {
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}

/* Custom thin scrollbar styling */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: rgb(148 163 184 / 0.1);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgb(148 163 184 / 0.3);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgb(148 163 184 / 0.5);
}

/* Smooth scrolling */
* {
  scroll-behavior: smooth;
}
</style>
