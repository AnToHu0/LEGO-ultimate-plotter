<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import type { FontData, TextAlignment, TextConfig } from '@/types'

// Состояние компонента
const fonts = ref<string[]>([])
const selectedFont = ref<string>('')
const fontSize = ref<number>(24)
const textAlignment = ref<TextAlignment>('left')
const inputText = ref<string>('')
const fontData = ref<FontData | null>(null)

// Загрузка списка доступных шрифтов
onMounted(async () => {
  try {
    fonts.value = ['handwritten', 'outline']
    selectedFont.value = fonts.value[0]
    await loadFontData(selectedFont.value)
  } catch (error) {
    console.error('Error loading fonts:', error)
  }
})

// Загрузка данных шрифта
const loadFontData = async (fontName: string) => {
  try {
    const response = await fetch(`/fonts/${fontName}.json`)
    if (!response.ok) {
      throw new Error(`Error loading font ${fontName}`)
    }
    fontData.value = await response.json()

    // Установка размера шрифта в допустимый диапазон
    const { minSize, maxSize } = fontData.value.meta
    if (fontSize.value < minSize) fontSize.value = minSize
    if (fontSize.value > maxSize) fontSize.value = maxSize
  } catch (error) {
    console.error(`Error loading font data ${fontName}:`, error)
  }
}

// Следим за изменением выбранного шрифта
watch(selectedFont, async (newFont) => {
  await loadFontData(newFont)
})

// Обработка изменений в тексте
watch(inputText, () => {
  updatePreview()
})

// Обновление предпросмотра текста
const updatePreview = () => {
  // Логика обновления предпросмотра будет добавлена позже
  // когда мы будем интегрировать отрисовку на SVG холсте
}

// Эмиты для связи с основным компонентом
const emit = defineEmits<{
  (event: 'text-data-ready', textConfig: TextConfig): void
}>()

// Отправка данных текста для отрисовки
const processText = () => {
  if (!fontData.value || !inputText.value) return

  emit('text-data-ready', {
    text: inputText.value,
    font: selectedFont.value,
    size: fontSize.value,
    alignment: textAlignment.value,
    fontData: fontData.value
  })
}

// Следим за изменениями основных параметров
watch([selectedFont, fontSize, textAlignment, inputText], () => {
  processText()
}, { deep: true })
</script>

<template>
  <div class="text-source">
    <div class="controls">
      <div class="control-group">
        <label for="font-select">Font:</label>
        <select id="font-select" v-model="selectedFont">
          <option v-for="font in fonts" :key="font" :value="font">
            {{ font === 'handwritten' ? 'Handwritten' : 'Outline' }}
          </option>
        </select>
      </div>

      <div class="control-group">
        <label for="font-size">Font size:</label>
        <input
          id="font-size"
          type="number"
          v-model="fontSize"
          :min="fontData?.meta.minSize || 8"
          :max="fontData?.meta.maxSize || 72"
        />
      </div>

      <div class="control-group">
        <label>Alignment:</label>
        <div class="alignment-controls">
          <button
            @click="textAlignment = 'left'"
            :class="{ active: textAlignment === 'left' }"
            title="Left align"
          >
            <Icon icon="mdi:format-align-left" />
          </button>
          <button
            @click="textAlignment = 'center'"
            :class="{ active: textAlignment === 'center' }"
            title="Center align"
          >
            <Icon icon="mdi:format-align-center" />
          </button>
          <button
            @click="textAlignment = 'right'"
            :class="{ active: textAlignment === 'right' }"
            title="Right align"
          >
            <Icon icon="mdi:format-align-right" />
          </button>
        </div>
      </div>
    </div>

    <div class="text-input-container">
      <label for="text-input">Enter text:</label>
      <textarea
        id="text-input"
        v-model="inputText"
        rows="4"
        placeholder="Enter text to render"
      ></textarea>
    </div>
  </div>
</template>

<style lang="less" scoped>
.text-source {
  padding: 20px;

  .controls {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 5px;

    label {
      font-weight: bold;
    }

    select, input {
      padding: 6px 10px;
      border: 1px solid @borders;
      border-radius: 4px;
    }
  }

  .alignment-controls {
    display: flex;
    gap: 5px;

    button {
      flex: 1;
      padding: 8px;
      background: #f5f5f5;
      border: 1px solid @borders;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;

      &.active {
        background-color: @text;
        color: #fff;
      }
    }
  }

  .text-input-container {
    display: flex;
    flex-direction: column;
    gap: 5px;

    label {
      font-weight: bold;
    }

    textarea {
      padding: 10px;
      border: 1px solid @borders;
      border-radius: 4px;
      resize: vertical;
    }
  }
}
</style>
