import { ref, onMounted, onUnmounted, watch, computed, readonly, type Ref } from 'vue'

interface BackgroundRotatorOptions {
  images: string[]
  intervalMs?: number
  enableTransition?: boolean
  transitionDuration?: number
}

export function useBackgroundRotator(
  elementRef: Ref<HTMLElement | null>,
  options: BackgroundRotatorOptions,
) {
  const { images, intervalMs = 5000, enableTransition = true, transitionDuration = 1000 } = options

  const currentImageIndex = ref(0)
  const isTransitioning = ref(false)
  let intervalId: number | null = null

  // Shuffle images array to start with a random order
  const shuffledImages = ref([...images].sort(() => Math.random() - 0.5))

  const setBackgroundImage = (imageUrl: string) => {
    if (!elementRef.value) return

    if (enableTransition) {
      isTransitioning.value = true

      // Create a temporary image element to preload the next image
      const img = new Image()
      img.onload = () => {
        if (elementRef.value) {
          elementRef.value.style.backgroundImage = `url(${imageUrl})`

          // Reset transition flag after animation completes
          setTimeout(() => {
            isTransitioning.value = false
          }, transitionDuration)
        }
      }
      img.src = imageUrl
    } else {
      elementRef.value.style.backgroundImage = `url(${imageUrl})`
    }
  }

  const nextImage = () => {
    if (shuffledImages.value.length === 0) return

    currentImageIndex.value = (currentImageIndex.value + 1) % shuffledImages.value.length

    // If we've cycled through all images, reshuffle for the next cycle
    if (currentImageIndex.value === 0) {
      shuffledImages.value = [...images].sort(() => Math.random() - 0.5)
    }

    setBackgroundImage(shuffledImages.value[currentImageIndex.value])
  }

  const startRotation = () => {
    if (intervalId) return // Already running

    // Set initial image
    if (shuffledImages.value.length > 0) {
      setBackgroundImage(shuffledImages.value[currentImageIndex.value])
    }

    // Start interval for rotation
    intervalId = window.setInterval(nextImage, intervalMs)
  }

  const stopRotation = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  const pauseRotation = () => {
    stopRotation()
  }

  const resumeRotation = () => {
    startRotation()
  }

  // Manually set a specific image by index
  const setImageByIndex = (index: number) => {
    if (index >= 0 && index < shuffledImages.value.length) {
      currentImageIndex.value = index
      setBackgroundImage(shuffledImages.value[index])
    }
  }

  // Get current image URL
  const getCurrentImage = () => {
    return shuffledImages.value[currentImageIndex.value] || ''
  }

  // Watch for element changes and apply initial styling
  watch(
    elementRef,
    (newElement) => {
      if (newElement && enableTransition) {
        // Apply CSS transition properties
        newElement.style.transition = `background-image ${transitionDuration}ms ease-in-out`
        newElement.style.backgroundSize = 'cover'
        newElement.style.backgroundPosition = 'center'
        newElement.style.backgroundRepeat = 'no-repeat'
      }
    },
    { immediate: true },
  )

  // Auto-start when component mounts
  onMounted(() => {
    if (images.length > 0) {
      startRotation()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopRotation()
  })

  return {
    // State
    currentImageIndex: readonly(currentImageIndex),
    isTransitioning: readonly(isTransitioning),
    shuffledImages: readonly(shuffledImages),

    // Actions
    startRotation,
    stopRotation,
    pauseRotation,
    resumeRotation,
    nextImage,
    setImageByIndex,
    getCurrentImage,

    // Computed
    totalImages: computed(() => shuffledImages.value.length),
    isRunning: computed(() => intervalId !== null),
  }
}

// Helper function to import multiple images using Vite's import.meta.glob
export function importBackgroundImages(glob: Record<string, unknown>): string[] {
  return Object.values(glob).map((module: unknown) => {
    if (typeof module === 'object' && module !== null && 'default' in module) {
      return (module as { default: string }).default
    }
    return module as string
  })
}
