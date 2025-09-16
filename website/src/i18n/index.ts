import { createI18n } from 'vue-i18n'
import messages from './messages'

export default createI18n({
  legacy: false, // Use Composition API
  locale: 'en', // Default language
  fallbackLocale: 'en', // Fallback language
  messages,
  // Enable global properties for templates
  globalInjection: true,
})
