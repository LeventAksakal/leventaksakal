<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

// Theme management
const isDark = useDark()
const toggleTheme = useToggle(isDark)

// I18n management
const { t, locale } = useI18n()

// Language toggle
const toggleLanguage = () => {
  locale.value = locale.value === 'en' ? 'tr' : 'en'
}

// Copy email functionality
const copyEmail = async () => {
  try {
    await navigator.clipboard.writeText('leventaksakal56@gmail.com')
    // You could add a toast notification here
    alert('Email copied to clipboard!')
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = 'leventaksakal56@gmail.com'
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('Email copied to clipboard!')
  }
}

// Projects data
const projects = [
  {
    id: 1,
    title: 'Project 1',
    description: 'A sample project description.',
    technologies: ['Vue.js', 'Tailwind CSS']
  },
  {
    id: 2,
    title: 'Project 2',
    description: 'Another sample project description.',
    technologies: ['React', 'Node.js']
  },
  {
    id: 3,
    title: 'Project 3',
    description: 'Yet another sample project description.',
    technologies: ['Python', 'Django']
  }
]
</script>


<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
    <!-- Navigation -->
    <nav
      class="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="font-bold text-xl">
            {{ t('common.name') }}
          </div>
          <div class="hidden md:flex space-x-8">
            <a href="#about"
              class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">{{
                t('nav.about') }}</a>
            <a href="#work"
              class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">{{
                t('nav.work') }}</a>
            <a href="#contact"
              class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">{{
                t('nav.contact') }}</a>
          </div>
          <div class="flex items-center space-x-2">
            <!-- Language Toggle -->
            <button @click="toggleLanguage"
              class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
              :aria-label="`Switch to ${locale === 'en' ? 'Turkish' : 'English'}`">
              {{ locale === 'en' ? 'TR' : 'EN' }}
            </button>
            <!-- Theme Toggle -->
            <button @click="() => toggleTheme()"
              class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              :aria-label="isDark ? t('common.switchToLight') : t('common.switchToDark')">
              <svg v-if="isDark" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clip-rule="evenodd" />
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-6xl mx-auto">
        <div class="text-center">
          <h1 class="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            {{ t('hero.hello') }}
            <span
              class="bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              {{ t('common.name') }}
            </span>
          </h1>
          <p class="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            {{ t('hero.tagline') }}
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              class="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors font-medium">
              {{ t('hero.viewWork') }}
            </button>
            <button
              class="px-8 py-3 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium">
              {{ t('hero.getInTouch') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- About Section -->
    <section id="about" class="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800">
      <div class="max-w-6xl mx-auto">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 class="text-4xl font-bold mb-6">{{ t('about.title') }}</h2>
            <p class="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              {{ t('about.text1') }}
            </p>
            <p class="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              {{ t('about.text2') }}
            </p>
            <div class="flex flex-wrap gap-3">
              <span class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium">JavaScript</span>
              <span class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium">Vue.js</span>
              <span class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium">React</span>
              <span class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium">Node.js</span>
              <span class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium">Python</span>
            </div>
          </div>
          <div class="relative">
            <div
              class="w-full h-96 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center">
              <span class="text-gray-500 dark:text-gray-400 text-lg">Your Photo Here</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Work Section -->
    <section id="work" class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-16">
          <h2 class="text-4xl font-bold mb-4">{{ t('work.title') }}</h2>
          <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {{ t('work.description') }}
          </p>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div v-for="project in projects" :key="project.id" class="group cursor-pointer">
            <div
              class="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-lg h-64 mb-4 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <span class="text-gray-500 dark:text-gray-400">{{ project.title }}</span>
            </div>
            <h3 class="text-xl font-semibold mb-2">{{ project.title }}</h3>
            <p class="text-gray-600 dark:text-gray-300 mb-3">{{ project.description }}</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="tech in project.technologies" :key="tech"
                class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-700 dark:text-gray-300">
                {{ tech }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact Section -->
    <section id="contact" class="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800">
      <div class="max-w-4xl mx-auto text-center">
        <h2 class="text-4xl font-bold mb-6">{{ t('contact.title') }}</h2>
        <p class="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          {{ t('contact.description') }}
        </p>
        <div class="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <!-- Email Display -->
          <div class="text-center sm:text-left cursor-pointer" @click="copyEmail">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ t('contact.getInTouch') || 'Get in touch' }}</p>
            <p
              class="text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              leventaksakal56@gmail.com</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('contact.copyEmail') || 'Click to copy' }}</p>
          </div>
          <div class="flex gap-4">
            <a href="https://www.linkedin.com/in/levent-aksakal-85b450236/"
              class="p-3 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a href="https://github.com/LeventAksakal"
              class="p-3 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-200 dark:border-gray-700">
      <div class="max-w-6xl mx-auto text-center">
        <p class="text-gray-600 dark:text-gray-400">
          © {{ new Date().getFullYear() }} {{ t('common.name') }}. {{ t('common.builtWith') }}
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Custom scrollbar for webkit browsers */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background-color: rgb(243 244 246 / var(--tw-bg-opacity));
}

.dark ::-webkit-scrollbar-track {
  --tw-bg-opacity: 1;
  background-color: rgb(31 41 55 / var(--tw-bg-opacity));
}

::-webkit-scrollbar-thumb {
  background-color: rgb(209 213 219 / var(--tw-bg-opacity));
  border-radius: 0.25rem;
}

.dark ::-webkit-scrollbar-thumb {
  --tw-bg-opacity: 1;
  background-color: rgb(75 85 99 / var(--tw-bg-opacity));
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgb(156 163 175 / var(--tw-bg-opacity));
}

.dark ::-webkit-scrollbar-thumb:hover {
  --tw-bg-opacity: 1;
  background-color: rgb(107 114 128 / var(--tw-bg-opacity));
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}
</style>
