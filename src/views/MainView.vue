<script setup lang="ts">
import { provide, reactive, ref, computed, watch } from "vue";
import type { Reactive } from "vue";
import type { SourceTabs, WorkerOption, Config } from "@/types";
import { useDebounceFn } from '@vueuse/core'
import { setupWebGL, processImageWithWebGL } from '@/utils/webgl'

const debugMode = ref(false)

const config: Reactive<Config> = reactive({
  defaultResolution: 400,
  orientation: 'h',
  scale: 1,
  offset: {
    x: 0,
    y: 0
  },
  img: null,
  imgData: null,
  mode: 'cmyk',
  algo: null
})

// Кеш параметров для каждого алгоритма
const algorithmsCache = reactive<Record<string, Record<string, string | number | boolean>>>({})

provide('config', config)

const canvasSize = computed(() => {
  if (config.orientation === 'v') {
    return {
      width: config.defaultResolution,
      height: Math.round(config.defaultResolution * 1.4142)
    }
  } else {
    return {
      width: Math.round(config.defaultResolution * 1.4142),
      height: config.defaultResolution
    }
  }
})

provide('canvasSize', canvasSize)

const loading = ref(false)

const imageSource = ref<SourceTabs>('image')

const workerMsg = ref('')

const changeColorMode = (mode: 'cmyk' | 'black') => {
  config.mode = mode
  colorSelector.value = mode === 'cmyk' ? 'c' : 'k'
}
const colorSelector = ref<'c' | 'm' | 'y' | 'k'>(config.mode === 'cmyk' ? 'c' : 'k')

const colorChannelCanvases = {
  c: document.createElement("canvas"),
  m: document.createElement("canvas"),
  y: document.createElement("canvas"),
  k: document.createElement("canvas")
}

const webglCanvases = {
  c: document.createElement("canvas"),
  m: document.createElement("canvas"),
  y: document.createElement("canvas"),
  k: document.createElement("canvas")
}

const colorChannelCtxs = {
  c: colorChannelCanvases.c.getContext('2d', { willReadFrequently: true }),
  m: colorChannelCanvases.m.getContext('2d', { willReadFrequently: true }),
  y: colorChannelCanvases.y.getContext('2d', { willReadFrequently: true }),
  k: colorChannelCanvases.k.getContext('2d', { willReadFrequently: true })
}

const svgPaths = reactive<{ c: null | string, m: null | string, y: null | string, k: null | string }>({
  c: null,
  m: null,
  y: null,
  k: null
})

let webWorker: Worker | null = null

const algoCachedConfig = reactive<Record<string, string | number | boolean>>({});
const algoControls = ref<WorkerOption[]>([])

const webglContexts = reactive({
  c: null as null | ReturnType<typeof setupWebGL>,
  m: null as null | ReturnType<typeof setupWebGL>,
  y: null as null | ReturnType<typeof setupWebGL>,
  k: null as null | ReturnType<typeof setupWebGL>
})

const initWebGL = () => {
  webglContexts.c = setupWebGL(webglCanvases.c)
  webglContexts.m = setupWebGL(webglCanvases.m)
  webglContexts.y = setupWebGL(webglCanvases.y)
  webglContexts.k = setupWebGL(webglCanvases.k)
}

const debouncedProcessImage = useDebounceFn((imgData?: ImageData) => {
  loading.value = true

  // Устанавливаем размеры для всех канвасов
  const setCanvasSize = (canvas: HTMLCanvasElement) => {
    canvas.width = canvasSize.value.width
    canvas.height = canvasSize.value.height
  }

  setCanvasSize(colorChannelCanvases.c)
  setCanvasSize(colorChannelCanvases.m)
  setCanvasSize(colorChannelCanvases.y)
  setCanvasSize(colorChannelCanvases.k)
  setCanvasSize(webglCanvases.c)
  setCanvasSize(webglCanvases.m)
  setCanvasSize(webglCanvases.y)
  setCanvasSize(webglCanvases.k)

  if (!webglContexts.c) {
    initWebGL()
  }

  if (debugMode.value) {
    const debug = document.body.querySelector('#debug')
    debug?.append(colorChannelCanvases.c)
    debug?.append(colorChannelCanvases.m)
    debug?.append(colorChannelCanvases.y)
    debug?.append(colorChannelCanvases.k)
  }

  if (imgData) {
    config.imgData = imgData
  }

  if (!config.imgData) {
    console.error('No image data available');
    loading.value = false;
    return;
  }

  // Создаем временный канвас для исходного изображения
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = canvasSize.value.width
  sourceCanvas.height = canvasSize.value.height
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (sourceCtx && config.imgData) {
    sourceCtx.putImageData(config.imgData, 0, 0)

    // Обрабатываем каждый канал через WebGL
    if (webglContexts.c) {
      processImageWithWebGL(webglContexts.c.gl, webglContexts.c.program, webglContexts.c.locations, webglContexts.c.buffers, sourceCanvas, 0)
      colorChannelCtxs.c?.drawImage(webglCanvases.c, 0, 0)
    }
    if (webglContexts.m) {
      processImageWithWebGL(webglContexts.m.gl, webglContexts.m.program, webglContexts.m.locations, webglContexts.m.buffers, sourceCanvas, 1)
      colorChannelCtxs.m?.drawImage(webglCanvases.m, 0, 0)
    }
    if (webglContexts.y) {
      processImageWithWebGL(webglContexts.y.gl, webglContexts.y.program, webglContexts.y.locations, webglContexts.y.buffers, sourceCanvas, 2)
      colorChannelCtxs.y?.drawImage(webglCanvases.y, 0, 0)
    }
    if (webglContexts.k) {
      processImageWithWebGL(webglContexts.k.gl, webglContexts.k.program, webglContexts.k.locations, webglContexts.k.buffers, sourceCanvas, 3)
      colorChannelCtxs.k?.drawImage(webglCanvases.k, 0, 0)
    }
  }

  if (!config.algo) {
    loadWorker(config.algo);
    return;
  }

  const currentAlgoCache = algorithmsCache[config.algo] || {};
  colorSelector.value = 'c';

  // Получаем ImageData и проверяем его корректность
  const imageData = colorChannelCtxs.c?.getImageData(0, 0, canvasSize.value.width, canvasSize.value.height);
  if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
    console.error('Failed to get valid ImageData from canvas');
    loading.value = false;
    return;
  }

  sendToWorker([
    { ...currentAlgoCache, width: canvasSize.value.width, height: canvasSize.value.height },
    imageData
  ]);
}, 150)

const processAlgoParameters = (workerOptions: [WorkerOption]) => {
  console.log('%cProcessing algo parameters', 'color: green; font-weight: bold', workerOptions);
  const newControls: WorkerOption[] = [];

  // Инициализируем кеш для текущего алгоритма, если его нет
  if (config.algo && !algorithmsCache[config.algo]) {
    algorithmsCache[config.algo] = {}
  }

  const currentAlgoCache = config.algo ? algorithmsCache[config.algo] : {}

  for (const option of workerOptions) {
    const newOption = reactive({ ...option });
    newOption.type = newOption.type ?? 'range';
    if (newOption.type !== 'checkbox') {
      if (currentAlgoCache[newOption.label] !== undefined) {
        console.log(`%cUsing cached value for ${newOption.label}`, 'color: purple', currentAlgoCache[newOption.label]);
        if (typeof currentAlgoCache[newOption.label] === 'number' &&
          typeof newOption.value === 'number' ||
          typeof currentAlgoCache[newOption.label] === 'string' &&
          typeof newOption.value === 'string'
        ) {
          newOption.value = currentAlgoCache[newOption.label] as string | number;
        }
      } else {
        console.log(`%cSetting initial value for ${newOption.label}`, 'color: orange', newOption.value);
        if (config.algo) {
          currentAlgoCache[newOption.label] = newOption.value;
        }
      }
    } else {
      if (currentAlgoCache[newOption.label] !== undefined) {
        newOption.checked = (currentAlgoCache[newOption.label] ?? newOption.checked ?? false) as boolean;
      } else if (config.algo) {
        currentAlgoCache[newOption.label] = newOption.checked ?? false;
      }
    }
    newControls.push(newOption);
  }
  algoControls.value = newControls;

  // Добавляем отслеживание изменений для каждого параметра
  algoControls.value.forEach(control => {
    watch(() => control.value, (newValue) => {
      console.log(`%cParameter ${control.label} changed to`, 'color: blue; font-weight: bold', newValue);
      if (config.algo) {
        algorithmsCache[config.algo][control.label] = newValue;
      }
    });
    if (control.type === 'checkbox') {
      watch(() => control.checked, (newValue) => {
        console.log(`%cCheckbox ${control.label} changed to`, 'color: blue; font-weight: bold', newValue);
        if (config.algo) {
          algorithmsCache[config.algo][control.label] = newValue;
        }
      });
    }
  });
}

const loadWorker = (src: string | null) => {
  console.log('%cLoading worker', 'color: purple; font-weight: bold', { src });
  if (!src) return
  loading.value = true
  if (webWorker) {
    console.log('%cTerminating existing worker', 'color: red');
    webWorker.terminate()
  }
  webWorker = new Worker(`/workers/${src}`)
  workerMsg.value = ""
  webWorker.onmessage = (msg) => {
    const [type, data] = msg.data
    console.log('%cWorker message', 'color: orange', { type, data });
    switch (type) {
      case 'sliders':
        loading.value = false
        if (src === config.algo) return
        config.algo = src;
        processAlgoParameters(data)
        // Запускаем обработку изображения после инициализации слайдеров
        if (config.imgData) {
          console.log('%cStarting initial image processing', 'color: green; font-weight: bold');
          debouncedProcessImage();
        }
        break
      case 'msg':
        workerMsg.value = data
        break
      case 'dbg':
        console.log('%cWorker debug', 'color: blue', data)
        break
      case 'svg-path':
        const currentAlgoCache = config.algo ? algorithmsCache[config.algo] : {}
        const workerConfig = { ...currentAlgoCache, width: canvasSize.value.width, height: canvasSize.value.height }
        if (colorSelector.value == 'c') {
          svgPaths.c = data.path
          colorSelector.value = 'm'
          sendToWorker([workerConfig, colorChannelCtxs.m?.getImageData(0, 0, canvasSize.value.width, canvasSize.value.height)])
        }
        else if (colorSelector.value == 'm') {
          svgPaths.m = data.path
          colorSelector.value = 'y'
          sendToWorker([workerConfig, colorChannelCtxs.y?.getImageData(0, 0, canvasSize.value.width, canvasSize.value.height)])
        }
        else if (colorSelector.value == 'y') {
          svgPaths.y = data.path
          colorSelector.value = 'k';
          sendToWorker([workerConfig, colorChannelCtxs.k?.getImageData(0, 0, canvasSize.value.width, canvasSize.value.height)])
        }
        else if (colorSelector.value == 'k') {
          svgPaths.k = data.path
          loading.value = false
        }
        break
    }
  }
}

const sendToWorker = (msg: [{ width: number, height: number }, ImageData | undefined]) => {
  console.log('%cSending to worker', 'color: red; font-weight: bold', {
    config: msg[0],
    hasImageData: !!msg[1]
  });

  // Проверяем наличие и корректность ImageData
  if (!msg[1] || !msg[1].data || !msg[1].width || !msg[1].height) {
    console.error('Invalid ImageData:', msg[1]);
    loading.value = false;
    return;
  }

  // Проверяем корректность конфига
  if (!msg[0] || typeof msg[0].width !== 'number' || typeof msg[0].height !== 'number') {
    console.error('Invalid config:', msg[0]);
    loading.value = false;
    return;
  }

  webWorker?.postMessage(msg)
}

const processImage = (imgData?: ImageData) => {
  debouncedProcessImage(imgData)
}

const processText = (textData: { path: string | null, isError: boolean }) => {
  console.log('Text SVG path received:', textData)

  // Очистка всех каналов
  svgPaths.c = null
  svgPaths.m = null
  svgPaths.y = null

  // Установка пути в черный канал
  svgPaths.k = textData.path

  // Обновляем флаг ошибки (для стилизации границы холста)
  isCanvasError.value = textData.isError

  // Отключаем индикатор загрузки
  loading.value = false
}

const isCanvasError = ref(false)

watch(algoCachedConfig, () => {
  if (config.algo) {
    debouncedProcessImage();
  }
}, { deep: true });
</script>

<template>
  <section id="plotter-config">
    <aside>
      <SourceSelector v-model="imageSource"/>
      <SelectorImage
        v-show="imageSource === 'image'"
        @image-data-ready="processImage"
        />
      <WebcamSource v-if="imageSource === 'webcam'" @image-data-ready="processImage" />
      <TextSource v-if="imageSource === 'text'" @text-data-ready="processText" />
      <template v-if="['image', 'webcam'].includes(imageSource) && config.imgData">
        <AlgorithmsSection
          @select-algo="loadWorker"
          @change-color-mode="changeColorMode"
        />
        <AlgorithmSliders
          :sliders="algoControls"
          @params-update="processImage"
        />
      </template>
    </aside>
    <main :class="{ loading }">
      <div id="debug"></div>
      <div class="svg-wrapper" :style="{ '--canvas-height': canvasSize.height + 'px' }">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          :width="canvasSize.width"
          :height="canvasSize.height"
          :viewBox="`0 0 ${canvasSize.width} ${canvasSize.height}`"
          :class="{ error: isCanvasError }"
          >
          <path
            id="black"
            style="stroke: black; stroke-width:0.2mm; fill:none;"
            :d="svgPaths.k?.toString()" />
          <path
            v-show="config.mode === 'cmyk'"
            id="cyan"
            style="stroke: cyan; stroke-width:0.2mm; fill:none;"
            transform="translate(1,1)"
            :d="svgPaths.c?.toString()" />
          <path
            v-show="config.mode === 'cmyk'"
            id="magenta" style="stroke: magenta; stroke-width:0.2mm; fill:none;"
            transform="translate(2,2)"
            :d="svgPaths.m?.toString()" />
          <path
            v-show="config.mode === 'cmyk'"
            id="yellow" style="stroke: yellow; stroke-width:0.2mm; fill:none;"
            transform="translate(3,3)"
            :d="svgPaths.y?.toString()" />
        </svg>
      </div>
      <div id="msgbox">{{ workerMsg }}</div>
    </main>
  </section>
</template>

<style lang="less" scoped>
#debug {
  display: flex;
  &>* {
    width: 200px;
    aspect-ratio: 1.4142;
  }
}
svg {
  border: 1px solid @borders;
  margin: 20px;

  &.error {
    border: 2px solid red;
  }
}
.svg-wrapper {
  margin: 20px;
  min-height: e(~"calc(var(--canvas-height) * 1.5)");

  svg {
    transform: scale(1.5);
    transform-origin: top left;
    margin: 0;
  }
}
#plotter-config {
  display: grid;
  grid-template-columns: 270px 1fr;
  flex: 1 1 100%;
  aside {
    border-right: 1px solid @borders;
  }
  #algorithms {
    padding: 0 20px;
    .flex {
      gap: 5px;
    }
    select {
      border: 1px solid @borders;
      flex: 1 1 auto;
    }
  }
  main {
    position: relative;
    &.loading {
      &:after {
        content: '';
        position: absolute;
        top: 20px;
        right: 20px;
        transform: translate(-50%);
        width: 70px;
        height: 70px;
        background: url(/img/gear.png) no-repeat center / contain;
        border-radius: 50%;
        animation: loader 2s infinite linear;
      }
    }
  }

}
@keyframes loader {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
