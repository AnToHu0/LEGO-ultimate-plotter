<script setup lang="ts">
import { ref, watch, onMounted, inject } from 'vue'
import { Icon } from '@iconify/vue'
import type { FontData, TextAlignment, Config } from '@/types'

// Получение конфигурации из родительского компонента
const config = inject<Config>('config')
const canvasSize = inject<{ width: number, height: number }>('canvasSize')

// Состояние компонента
const fonts = ref<string[]>([])
const selectedFont = ref<string>('')
const fontSize = ref<number>(24)
const textAlignment = ref<TextAlignment>('left')
const inputText = ref<string>('')
const fontData = ref<FontData | null>(null)
const orientation = ref(config?.orientation || 'h')
const autoWrap = ref(true)
const svgPath = ref<string | null>(null)
const isOutOfBounds = ref(false) // Флаг для отслеживания выхода за границы
const humanisation = ref<number>(0) // Параметр для добавления "человечности" к шрифту
const letterSpacingMultiplier = ref<number>(1) // Множитель для межбуквенного интервала
const lineHeightMultiplier = ref<number>(1) // Множитель для высоты строки

// Для автоматического обнаружения шрифтов используем glob импорт Vite
// Импортируем все JSON файлы из директории шрифтов
const fontModules = import.meta.glob('/public/fonts/*.json', { eager: true })

// Функция для добавления шума к координатам в зависимости от humanisation и длины отрезка
// Учитывает направление движения и добавляет шум преимущественно перпендикулярно направлению
// Также учитывает резкие повороты и уменьшает шум на них
const addNoise = (point: [number, number], prevPoint: [number, number] | null, nextPoint: [number, number] | null, segmentLength: number): [number, number] => {
  const [x, y] = point;

  if (humanisation.value === 0 || (!prevPoint && !nextPoint)) {
    return [x, y];
  }

  // Базовый размер шрифта для расчета пропорции
  const baseSize = 24;

  // Коэффициент обратной пропорциональности размеру шрифта
  const sizeRatio = baseSize / fontSize.value;

  // Максимальное значение шума зависит от уровня humanisation и длины отрезка
  const maxNoiseBase = (humanisation.value * 0.03) * Math.min(segmentLength * 0.2, baseSize * 0.1) * sizeRatio;

  let directionX = 0;
  let directionY = 0;
  let angleMultiplier = 1.0;

  // Определение направления движения
  if (prevPoint && nextPoint) {
    // Для точек в середине пути - учитываем направление до и после
    const prevDirX = x - prevPoint[0];
    const prevDirY = y - prevPoint[1];
    const nextDirX = nextPoint[0] - x;
    const nextDirY = nextPoint[1] - y;

    // Вычисляем длины векторов для нормализации
    const prevLength = Math.sqrt(prevDirX * prevDirX + prevDirY * prevDirY);
    const nextLength = Math.sqrt(nextDirX * nextDirX + nextDirY * nextDirY);

    if (prevLength > 0 && nextLength > 0) {
      // Нормализованные направления
      const prevNormX = prevDirX / prevLength;
      const prevNormY = prevDirY / prevLength;
      const nextNormX = nextDirX / nextLength;
      const nextNormY = nextDirY / nextLength;

      // Среднее направление
      directionX = (prevNormX + nextNormX) / 2;
      directionY = (prevNormY + nextNormY) / 2;

      // Вычисление скалярного произведения для определения угла между векторами
      // cos(угла) = (a·b)/(|a|*|b|)
      const dotProduct = prevNormX * nextNormX + prevNormY * nextNormY;

      // Корректировка для резких углов: чем меньше dotProduct (более отрицательный),
      // тем более резкий поворот
      // Мы хотим уменьшать шум на резких поворотах, поэтому:
      angleMultiplier = 0.3 + 0.7 * ((dotProduct + 1) / 2); // от 0.3 до 1.0
    }
  } else if (prevPoint) {
    // Для конечных точек - учитываем только предыдущее направление
    directionX = x - prevPoint[0];
    directionY = y - prevPoint[1];
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    if (length > 0) {
      directionX /= length;
      directionY /= length;
    }
  } else if (nextPoint) {
    // Для начальных точек - учитываем только следующее направление
    directionX = nextPoint[0] - x;
    directionY = nextPoint[1] - y;
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    if (length > 0) {
      directionX /= length;
      directionY /= length;
    }
  }

  // Нормализуем направление если оно было определено
  const dirLength = Math.sqrt(directionX * directionX + directionY * directionY);
  if (dirLength > 0) {
    directionX /= dirLength;
    directionY /= dirLength;

    // Вычисляем перпендикулярное направление (поворот на 90 градусов)
    const perpX = -directionY;
    const perpY = directionX;

    // Конечный множитель шума
    const maxNoise = maxNoiseBase * angleMultiplier;

    // Распределяем шум: 80% перпендикулярно направлению, 20% вдоль направления
    const noisePerpendicular = (Math.random() * 2 - 1) * maxNoise;
    const noiseAlong = (Math.random() * 2 - 1) * maxNoise * 0.2;

    // Применяем шум в соответствующих направлениях
    return [
      x + (perpX * noisePerpendicular + directionX * noiseAlong),
      y + (perpY * noisePerpendicular + directionY * noiseAlong)
    ];
  }

  // Если направление не определено, просто добавляем случайный шум
  const maxNoise = maxNoiseBase * angleMultiplier;
  return [
    x + (Math.random() * 2 - 1) * maxNoise,
    y + (Math.random() * 2 - 1) * maxNoise
  ];
};

// Загрузка списка доступных шрифтов
onMounted(async () => {
  try {
    // Извлекаем имена файлов шрифтов из путей, полученных через glob
    const fontFiles = Object.keys(fontModules).map(path => {
      // Извлекаем имя файла из пути (без расширения .json)
      const fileName = path.split('/').pop()?.replace('.json', '')
      return fileName
    }).filter(Boolean) as string[]

    // Устанавливаем список доступных шрифтов
    fonts.value = fontFiles

    if (fontFiles.length > 0) {
      selectedFont.value = fontFiles[0]
      await loadFontData(selectedFont.value)
    } else {
      console.error('Не найдено доступных шрифтов')
    }
  } catch (error) {
    console.error('Ошибка загрузки шрифтов:', error)
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

    generateSvgPath()
  } catch (error) {
    console.error(`Error loading font data ${fontName}:`, error)
  }
}

// Вычисляем ширину текста на основе размера шрифта
const calculateTextWidth = (text: string, size: number): number => {
  if (!fontData.value) return 0

  let totalWidth = 0
  const { characters } = fontData.value
  const scale = size / 10

  // Получаем значения из метаданных
  const letterSpacing = (fontData.value.meta.letterSpacing || 0.3) * size * letterSpacingMultiplier.value;
  const spaceWidth = (fontData.value.meta.spaceWidth || 3) * scale;
  const lowercaseScale = fontData.value.meta.lowercaseScale || 1;

  // Проходим по каждому символу и вычисляем его фактическую ширину
  for (const char of text) {
    // Для пробела используем специальное значение из метаданных
    if (char === ' ') {
      totalWidth += spaceWidth;
      continue;
    }

    // Определяем, является ли символ строчной буквой
    const isLowercase = /[a-z]/.test(char);

    // Применяем масштаб в зависимости от типа символа
    const charScale = isLowercase ? scale * lowercaseScale : scale;

    // Получаем пути для символа или используем пробел, если символ не найден
    const charPaths = characters[char] || characters[' '] || [[[0, 0], [0, 0]]];

    // Находим максимальную X-координату для символа
    let maxX = 0;
    for (const path of charPaths) {
      for (const [x] of path) {
        if (x > maxX) maxX = x;
      }
    }

    // Ширина символа с учетом масштаба + межбуквенный интервал
    const charWidth = (maxX * charScale) + letterSpacing;
    totalWidth += charWidth;
  }

  return totalWidth;
}

// Разбиваем текст на строки с учетом переносов
const splitTextIntoLines = (text: string, maxWidth: number): string[] => {
  // Если авто-перенос отключен, просто разбиваем по символу новой строки
  if (!autoWrap.value) {
    return text.split('\n')
  }

  // Иначе учитываем авто-перенос
  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    let line = ''
    const words = paragraph.split(' ')

    for (const word of words) {
      // Проверяем, можно ли добавить слово к текущей строке
      const testLine = line ? line + ' ' + word : word
      const lineWidth = calculateTextWidth(testLine, fontSize.value)
      const wordWidth = calculateTextWidth(word, fontSize.value)

      // Если слово само по себе шире максимальной ширины, но строка пустая,
      // добавляем его в любом случае (иначе оно никогда не будет добавлено)
      if (wordWidth > maxWidth && line === '') {
        lines.push(word)
        line = ''
        continue
      }

      // Если добавление слова приведет к превышению ширины и текущая строка не пуста,
      // переносим текущую строку и начинаем новую с этого слова
      if (lineWidth > maxWidth && line !== '') {
        lines.push(line)
        line = word
      } else {
        // Иначе добавляем слово к текущей строке
        line = testLine
      }
    }

    // Добавляем последнюю строку параграфа, если она не пуста
    if (line) {
      lines.push(line)
    }
  }

  return lines
}

// Генерируем SVG путь из текста
const generateSvgPath = (): void => {
  if (!fontData.value || !inputText.value || !canvasSize?.value) {
    svgPath.value = null
    return
  }

  const { characters } = fontData.value

  // Определяем масштаб символов на основе размера шрифта
  const scale = fontSize.value / 10

  // Получаем значения из метаданных
  const letterSpacing = (fontData.value.meta.letterSpacing || 0.3) * fontSize.value * letterSpacingMultiplier.value;
  const lineHeightFactor = (fontData.value.meta.lineHeight || 1.5) * lineHeightMultiplier.value;
  const spaceWidth = (fontData.value.meta.spaceWidth || 3) * scale;
  // Коэффициент масштабирования для строчных букв
  const lowercaseScale = fontData.value.meta.lowercaseScale || 1;

  // Получаем доступную ширину холста с учетом отступов
  const maxWidth = canvasSize.value.width - 40 // отступы по 20px с каждой стороны

  // Разбиваем текст на строки
  const lines = splitTextIntoLines(inputText.value, maxWidth)

  // Линии для SVG пути
  const pathCommands: string[] = []

  // Сбрасываем флаг выхода за границы
  isOutOfBounds.value = false

  // Вычисляем интервал между строками на основе метаданных
  const lineHeight = fontSize.value * lineHeightFactor

  // Начальная вертикальная позиция (сверху с небольшим отступом)
  let yPosition = fontSize.value

  // Проверка выхода по вертикали относительно реального размера холста
  if (yPosition + (lines.length - 1) * lineHeight > canvasSize.value.height) {
    isOutOfBounds.value = true
  }

  // Обрабатываем каждую строку текста
  for (const line of lines) {
    // Вычисляем ширину строки для выравнивания
    const lineWidth = calculateTextWidth(line, fontSize.value)

    // Определяем начальную позицию X на основе выравнивания
    let xPosition = 20 // левый отступ по умолчанию

    if (textAlignment.value === 'center') {
      xPosition = (canvasSize.value.width - lineWidth) / 2
    } else if (textAlignment.value === 'right') {
      xPosition = canvasSize.value.width - lineWidth - 20
    }

    // Начальная позиция для символа
    let charX = xPosition

    // Проходим по каждому символу в строке
    for (const char of line) {
      // Для пробела просто смещаем координату X и пропускаем отрисовку
      if (char === ' ') {
        charX += spaceWidth;
        continue;
      }

      // Получаем точки для символа или используем пробел, если символ не найден
      const charPaths = characters[char] || characters[' '] || [[[0, 0], [0, 0]]];

      // Определяем, является ли символ строчной буквой
      // a-z - это строчные буквы
      const isLowercase = /[a-z]/.test(char);

      // Выбираем масштаб в зависимости от типа символа
      const charScale = isLowercase ? scale * lowercaseScale : scale;

      // Смещение по Y для строчных букв, чтобы они выравнивались по базовой линии
      const baselineOffset = isLowercase ? (fontSize.value * (1 - lowercaseScale)) : 0;

      // Максимальная X-координата для определения ширины символа
      let maxX = 0;

      // Если у нас есть пути для этого символа
      if (charPaths.length > 0) {
        // Обрабатываем каждый подпуть (штрих) символа
        for (const path of charPaths) {
          // Создаем новый SVG путь для каждого штриха
          if (path.length > 0) {
            // Вычисляем длину сегмента для пропорционального шума
            let segmentLength = 0;
            if (path.length > 1) {
              const firstPoint = path[0];
              const lastPoint = path[path.length - 1];
              segmentLength = Math.sqrt(
                Math.pow((lastPoint[0] - firstPoint[0]) * charScale, 2) +
                Math.pow((lastPoint[1] - firstPoint[1]) * charScale, 2)
              );
            }

            for (let i = 0; i < path.length; i++) {
              // Получаем текущую, предыдущую и следующую точки для определения направления
              const currentPoint = path[i];
              const prevPoint = i > 0 ? path[i-1] : null;
              const nextPoint = i < path.length - 1 ? path[i+1] : null;

              // Обновляем максимальную X-координату
              if (currentPoint[0] > maxX) maxX = currentPoint[0];

              // Добавляем шум к координатам с учетом направления и углов
              let noisyPoint = currentPoint;
              if (humanisation.value > 0) {
                noisyPoint = addNoise(currentPoint, prevPoint, nextPoint, segmentLength);
              }

              // Масштабируем и смещаем координаты
              const scaledX = noisyPoint[0] * charScale + charX;
              const scaledY = noisyPoint[1] * charScale + yPosition + baselineOffset;

              // Округляем координаты до 2 знаков после запятой
              const roundedX = parseFloat(scaledX.toFixed(2));
              const roundedY = parseFloat(scaledY.toFixed(2));

              // Проверка выхода за границы холста (без учета отступов)
              if (
                roundedX < 0 || roundedX > canvasSize.value.width ||
                roundedY < 0 || roundedY > canvasSize.value.height
              ) {
                isOutOfBounds.value = true;
              }

              // Добавляем команду к пути с округленными координатами
              if (i === 0) {
                pathCommands.push(`M ${roundedX},${roundedY}`);
              } else {
                pathCommands.push(`L ${roundedX},${roundedY}`);
              }
            }
          }
        }
      }

      // Смещаем горизонтальную позицию для следующего символа
      // с учетом фактической ширины текущего символа и межбуквенного интервала
      // Для строчных букв применяем соответствующий масштаб
      charX += (maxX * charScale) + letterSpacing;

      // Проверка выхода за правую границу холста (без учета отступов)
      if (charX > canvasSize.value.width) {
        isOutOfBounds.value = true;
      }
    }

    // Переходим к следующей строке
    yPosition += lineHeight

    // Проверка выхода за нижнюю границу холста (без учета отступов)
    if (yPosition > canvasSize.value.height) {
      isOutOfBounds.value = true
    }
  }

  // Собираем все команды в единый SVG путь
  svgPath.value = pathCommands.join(' ')
}

// Следим за изменением выбранного шрифта
watch(selectedFont, async (newFont) => {
  await loadFontData(newFont)
})

// Обработка изменений в тексте и других параметрах
watch([inputText, fontSize, textAlignment, autoWrap, humanisation, letterSpacingMultiplier, lineHeightMultiplier], () => {
  // Преобразуем значения слайдеров в числа и округляем, если они случайно стали строками
  fontSize.value = parseInt(Number(fontSize.value).toFixed(0));
  letterSpacingMultiplier.value = parseFloat(Number(letterSpacingMultiplier.value).toFixed(2));
  lineHeightMultiplier.value = parseFloat(Number(lineHeightMultiplier.value).toFixed(2));

  generateSvgPath()
})

// Слежение за изменением ориентации в родительском компоненте
watch(() => config?.orientation, (newOrientation) => {
  if (newOrientation) {
    orientation.value = newOrientation
    generateSvgPath()
  }
})

// Изменение ориентации
const changeOrientation = (newOrientation: 'h' | 'v') => {
  orientation.value = newOrientation
  if (config) {
    config.orientation = newOrientation
  }
  generateSvgPath()
}

// Эмиты для связи с основным компонентом
const emit = defineEmits<{
  (event: 'text-data-ready', svgData: { path: string | null, isError: boolean }): void
}>()

// Отправка данных текста для отрисовки
const processText = () => {
  if (!svgPath.value) return

  emit('text-data-ready', {
    path: svgPath.value,
    isError: isOutOfBounds.value
  })
}

// Следим за изменениями SVG пути
watch([svgPath, isOutOfBounds], () => {
  processText()
})
</script>

<template>
  <div class="text-source">
    <div class="controls">
      <div class="control-group">
        <label for="font-select">Font:</label>
        <select id="font-select" v-model="selectedFont">
          <option v-for="font in fonts" :key="font" :value="font">
            {{
              font === 'handwritten' ? 'Handwritten' :
              font === 'outline' ? 'Outline' :
              font === 'CutlingsDualis' ? 'Cutlings Dualis' :
              font === 'EMSAllure' ? 'EMS Allure' :
              font === 'HersheyGothEnglish' ? 'Gothic English' :
              font === 'HersheySerifMed' ? 'Serif Medium' :
              font === 'HersheyMusic' ? 'Music Notes' : font
            }}
          </option>
        </select>
      </div>

      <div class="control-group">
        <label for="font-size">Font size: {{ fontSize }}</label>
        <input
          id="font-size"
          type="range"
          v-model="fontSize"
          :min="fontData?.meta.minSize || 8"
          :max="fontData?.meta.maxSize || 72"
          step="1"
          class="slider"
        />
        <div class="slider-labels">
          <span>Small</span>
          <span>Large</span>
        </div>
      </div>

      <div class="control-group">
        <label for="letter-spacing">Letter spacing: {{ ((fontData?.meta.letterSpacing || 0.3) * letterSpacingMultiplier).toFixed(2) }}</label>
        <input
          id="letter-spacing"
          type="range"
          v-model="letterSpacingMultiplier"
          min="0.1"
          max="3"
          step="0.01"
          class="slider"
        />
        <div class="slider-labels">
          <span>Tight</span>
          <span>Wide</span>
        </div>
      </div>

      <div class="control-group">
        <label for="line-height">Line height: {{ ((fontData?.meta.lineHeight || 1.5) * lineHeightMultiplier).toFixed(2) }}</label>
        <input
          id="line-height"
          type="range"
          v-model="lineHeightMultiplier"
          min="0.5"
          max="2.5"
          step="0.01"
          class="slider"
        />
        <div class="slider-labels">
          <span>Compact</span>
          <span>Spacious</span>
        </div>
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

      <div class="control-group">
        <label>Orientation:</label>
        <div class="orientation-controls">
          <button
            @click="changeOrientation('h')"
            :class="{ active: orientation === 'h' }"
            title="Horizontal (Landscape)"
          >
            <span>Landscape</span>
          </button>
          <button
            @click="changeOrientation('v')"
            :class="{ active: orientation === 'v' }"
            title="Vertical (Portrait)"
          >
            <span>Portrait</span>
          </button>
        </div>
      </div>

      <div class="control-group">
        <div class="checkbox-control">
          <input type="checkbox" id="auto-wrap" v-model="autoWrap" />
          <label for="auto-wrap">Auto word wrap</label>
        </div>
      </div>

      <div class="control-group" v-if="fontData?.meta.humanizeable !== false">
        <label for="humanisation">Humanisation: {{ humanisation }}</label>
        <input
          id="humanisation"
          type="range"
          v-model="humanisation"
          min="0"
          max="10"
          step="0.5"
          class="slider"
        />
        <div class="slider-labels">
          <span>Precise</span>
          <span>Natural</span>
          <span>First-grader</span>
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

    select, input[type="number"] {
      padding: 6px 10px;
      border: 1px solid @borders;
      border-radius: 4px;
    }

    .checkbox-control {
      display: flex;
      align-items: center;
      gap: 8px;

      input[type="checkbox"] {
        margin: 0;
      }

      label {
        font-weight: normal;
        cursor: pointer;
      }
    }

    .slider {
      -webkit-appearance: none;
      width: 100%;
      height: 8px;
      border-radius: 4px;
      background: #e0e0e0;
      outline: none;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: @text;
        cursor: pointer;
      }

      &::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: @text;
        cursor: pointer;
      }
    }

    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }
  }

  .alignment-controls,
  .orientation-controls {
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
      font-size: 12px;

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
    margin-bottom: 20px;

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
