<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject } from "vue";
import type { ComputedRef } from 'vue'
import type { Config } from "@/types";
import { Icon } from '@iconify/vue';

const config = inject<Config>('config')!
const canvasSize = inject<ComputedRef<{ width: number, height: number }>>('canvasSize')!

const isStreaming = ref(false);
const stream = ref<MediaStream | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const availableDevices = ref<MediaDeviceInfo[]>([]);
const selectedDeviceId = ref<string | null>(null);
const orientation = ref(config.orientation);

// Временный канвас для обработки кадра
const processingCanvas = document.createElement('canvas');

watch(canvasSize, () => {
  if (processingCanvas) {
    processingCanvas.width = canvasSize.value.width;
    processingCanvas.height = canvasSize.value.height;
  }
});

watch(orientation, () => {
  config.orientation = orientation.value;
  if (isStreaming.value) {
    startStream();
  }
});

const emit = defineEmits<{
  (event: 'image-data-ready', imgData: ImageData): void
}>()

const getDevices = async () => {
  try {
    const mediaDevices = await navigator.mediaDevices.enumerateDevices()
    availableDevices.value = mediaDevices.filter(device => device.kind === 'videoinput')
    if (!selectedDeviceId.value && availableDevices.value.length > 0) {
      selectedDeviceId.value = availableDevices.value[0].deviceId
    }
  } catch (error) {
    console.error('Error getting devices:', error)
  }
}

const startStream = async () => {
  try {
    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop())
    }

    stream.value = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: selectedDeviceId.value ? { exact: selectedDeviceId.value } : undefined
      }
    })

    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
      isStreaming.value = true
      try {
        await videoRef.value.play()
      } catch (error) {
        console.error('Error playing video:', error)
      }
    }
  } catch (error) {
    console.error('Error accessing webcam:', error)
    isStreaming.value = false
  }
}

function toggleStream() {
  if (isStreaming.value) {
    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop());
    }
    isStreaming.value = false;
  } else {
    startStream();
  }
}

const captureFrame = () => {
  if (!videoRef.value || !processingCanvas) return null

  const context = processingCanvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  // Целевые размеры из конфига
  const targetWidth = canvasSize.value.width
  const targetHeight = canvasSize.value.height

  // Размеры исходного видео
  const videoWidth = videoRef.value.videoWidth
  const videoHeight = videoRef.value.videoHeight

  // Устанавливаем размеры канваса в соответствии с конфигом и ориентацией
  processingCanvas.width = targetWidth
  processingCanvas.height = targetHeight

  // Для чистого канваса
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, targetWidth, targetHeight)

  // Вычисляем соотношение сторон
  const targetRatio = targetWidth / targetHeight
  const videoRatio = videoWidth / videoHeight

  // Переменные для drawImage (sx, sy, sw, sh, dx, dy, dw, dh)
  let sx = 0, sy = 0, sw = videoWidth, sh = videoHeight

  // Применяем стратегию cover в зависимости от соотношения сторон
  if (videoRatio > targetRatio) {
    // Видео шире, обрезаем по бокам
    sw = videoHeight * targetRatio
    sx = (videoWidth - sw) / 2
  } else {
    // Видео выше, обрезаем сверху и снизу
    sh = videoWidth / targetRatio
    sy = (videoHeight - sh) / 2
  }

  // Рисуем изображение с учетом масштабирования и обрезки
  context.drawImage(videoRef.value, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)

  // Получаем данные изображения
  const imageData = context.getImageData(0, 0, targetWidth, targetHeight)

  // Проверяем корректность данных
  try {
    // Инициализируем объект для хранения данных проверки
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: { nanValues: 0, outOfRangeValues: 0 }
    };

    // Базовые проверки
    if (!imageData || !imageData.data) {
      validation.isValid = false;
      validation.errors.push('Некорректные данные изображения');
      console.error('Ошибка при захвате кадра: некорректные данные изображения');
      return null;
    }

    // Проверяем соответствие размеров
    if (imageData.width !== targetWidth || imageData.height !== targetHeight) {
      validation.warnings.push(`Размеры изображения (${imageData.width}x${imageData.height}) не соответствуют ожидаемым (${targetWidth}x${targetHeight})`);
    }

    // Проверяем длину массива данных
    const expectedLength = targetWidth * targetHeight * 4;
    if (imageData.data.length !== expectedLength) {
      validation.isValid = false;
      validation.errors.push(`Длина массива данных (${imageData.data.length}) не соответствует ожидаемой (${expectedLength})`);
    }

    // Проверяем наличие некорректных значений
    for (let i = 0; i < imageData.data.length; i++) {
      const value = imageData.data[i];
      if (isNaN(value)) {
        validation.stats.nanValues++;
        validation.isValid = false;
        // Заменяем NaN значения на 0 (или 255 для альфа-канала)
        imageData.data[i] = (i % 4 === 3) ? 255 : 0;
      } else if (value < 0 || value > 255) {
        validation.stats.outOfRangeValues++;
        validation.isValid = false;
        // Заменяем значения вне диапазона
        imageData.data[i] = value < 0 ? 0 : 255;
      }
    }

    // Выводим результаты проверки
    if (!validation.isValid) {
      console.warn('Обнаружены проблемы в данных изображения:', validation);
    }
  } catch (error) {
    console.error('Ошибка при проверке данных изображения:', error);
  }

  emit('image-data-ready', imageData)
  return imageData
}

onMounted(async () => {
  await getDevices();
  navigator.mediaDevices.addEventListener('devicechange', getDevices);
});

onUnmounted(() => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
  }
  navigator.mediaDevices.removeEventListener('devicechange', getDevices);
});

// Следим за изменением выбранной камеры
watch(selectedDeviceId, () => {
  if (isStreaming.value) {
    startStream();
  }
});
</script>

<template>
  <div class="webcam-container">
    <!-- Селектор камеры -->
    <div class="line">
      <label class="select-container">
        Camera:
        <select v-model="selectedDeviceId">
          <option v-for="device in availableDevices"
                  :key="device.deviceId"
                  :value="device.deviceId">
            {{ device.label || `Camera ${availableDevices.indexOf(device) + 1}` }}
          </option>
        </select>
      </label>
    </div>

    <!-- Ориентация -->
    <div class="line">
      Orientation:
      <label>Vertical<input name='orientation' v-model='orientation' value="v" type="radio"></label>
      <label>Horizontal<input name='orientation' v-model='orientation' value="h" type="radio"></label>
    </div>

    <!-- Preview с фиксированным соотношением сторон -->
    <div class="line">
      <div class="video-container" :class="orientation">
        <video
          ref="videoRef"
          :class="{ paused: !isStreaming }"
          playsinline
          autoplay
          muted
        />
      </div>
    </div>

    <!-- Контролы -->
    <div class="line">
      <button class="btn" @click="toggleStream">
        <Icon :icon="isStreaming ? 'mdi:pause' : 'mdi:play'" />
        {{ isStreaming ? 'Stop' : 'Start' }}
      </button>
      <button class="btn" @click="captureFrame" :disabled="!isStreaming">
        Use Image
      </button>
    </div>
  </div>
</template>

<style lang="less" scoped>
.webcam-container {
  padding: 10px 20px;

  .line {
    margin-bottom: 10px;

    .video-container {
      border: 1px solid @borders;
      height: 160px;
      aspect-ratio: 1.4142;
      margin: 10px auto;
      background-color: #f8f8f8;
      background-image:
        linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0),
        linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0);
      background-size: 40px 40px;
      background-position: 0 0, 20px 20px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;

      &.v {
        aspect-ratio: calc(1 / 1.4142);
      }

      video {
        min-width: 100%;
        min-height: 100%;
        width: auto;
        height: auto;
        object-fit: cover;

        &.paused {
          opacity: 0.7;
        }
      }
    }

    .select-container {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      select {
        max-width: 170px;
        width: 100%;
      }
    }

    button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    select {
      color: @text;
    }
  }
}
</style>
