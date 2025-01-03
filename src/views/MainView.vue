<script setup lang="ts">
import { provide, reactive, ref, computed } from "vue";
import type { Reactive } from "vue";
import type { SourceTabs, WorkerOption, Config } from "@/types";

const debugMode = ref(false)

const config: Reactive<Config> = reactive({
  defaultResolution: 600,
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
const colorChannelCtxs = {
  c: colorChannelCanvases.c.getContext('2d'),
  m: colorChannelCanvases.m.getContext('2d'),
  y: colorChannelCanvases.y.getContext('2d'),
  k: colorChannelCanvases.k.getContext('2d')
}

const svgPaths = reactive<{ c: null | string, m: null | string, y: null | string, k: null | string }>({
  c: null,
  m: null,
  y: null,
  k: null
})

let webWorker: Worker | null = null

const algoCachedConfig: Record<string, string | number | boolean> = {};
const algoControls = ref<WorkerOption[]>([])
const processAlgoParameters = (workerOptions: [WorkerOption]) => {
  algoControls.value = []
  for (const option of workerOptions) {
    option.type = option.type ?? 'range'
    if (option.type !== 'checkbox') {
      if (algoCachedConfig[option.label]) {
        if (typeof algoCachedConfig[option.label] === 'number' &&
          typeof option.value === 'number' ||
          typeof algoCachedConfig[option.label] === 'string' &&
          typeof option.value === 'string'
        ) {
          option.value = algoCachedConfig[option.label] as string | number
        }
      } else {
        algoCachedConfig[option.label] = option.value
      }
    } else {
      if (algoCachedConfig[option.label]) {
        option.checked = (algoCachedConfig[option.label] ?? option.checked ?? false) as boolean
      }
    }
    algoControls.value.push(option)
  }
}

const loadWorker = (src: string | null) => {
  if (!src) return
  loading.value = true
  if (webWorker) webWorker.terminate()
  webWorker = new Worker(`/workers/${src}`)
  workerMsg.value = ""
  webWorker.onmessage = (msg) => {
    const [type, data] = msg.data
    switch (type) {
      case 'sliders':
        loading.value = false
        if (src === config.algo) return
        config.algo = src;
        processAlgoParameters(data)
        processImage();
        break
      case 'msg':
        workerMsg.value = data
        break
      case 'dbg':
        console.log(data)
        break
      case 'svg-path':
        const workerConfig = { ...algoCachedConfig, width: canvasSize.value.width, height: canvasSize.value.height }
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
  console.log(msg)
  webWorker?.postMessage(msg)
}

const processImage = (imgData: ImageData | undefined = undefined) => {
  // debugger
  loading.value = true
  colorChannelCanvases.c.width = canvasSize.value.width
  colorChannelCanvases.m.width = canvasSize.value.width
  colorChannelCanvases.y.width = canvasSize.value.width
  colorChannelCanvases.k.width = canvasSize.value.width
  colorChannelCanvases.c.height = canvasSize.value.height
  colorChannelCanvases.m.height = canvasSize.value.height
  colorChannelCanvases.y.height = canvasSize.value.height
  colorChannelCanvases.k.height = canvasSize.value.height
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
  applyFilter(0, colorChannelCtxs.c)
  applyFilter(1, colorChannelCtxs.m)
  applyFilter(2, colorChannelCtxs.y)
  applyFilter(3, colorChannelCtxs.k)

  loadWorker(config.algo);
  colorSelector.value = 'c';
  sendToWorker([{ ...algoCachedConfig, width: canvasSize.value.width, height: canvasSize.value.height }, colorChannelCtxs.c?.getImageData(0, 0, canvasSize.value.width, canvasSize.value.height)]);
}

const applyFilter = (channel: number, context: CanvasRenderingContext2D | null) => {

  if (!context) return
  let x, y, offset
  let r, g, b, k, c, m, yl
  const mod = context.createImageData(canvasSize.value.width, canvasSize.value.height)
  for (x = 0; x < canvasSize.value.width; x++) {
    for (y = 0; y < canvasSize.value.height; y++) {
      offset = (canvasSize.value.width * y + x) * 4

      if ((channel < 0) || (channel > 3)) {
        mod.data[offset] = config.imgData!.data[offset]
        mod.data[offset + 1] = config.imgData!.data[offset + 1]
        mod.data[offset + 2] = config.imgData!.data[offset + 2]
        mod.data[offset + 3] = config.imgData!.data[offset + 3]
      }
      else {
        r = config.imgData!.data[offset] / 255
        g = config.imgData!.data[offset + 1] / 255
        b = config.imgData!.data[offset + 2] / 255
        k = Math.min(1 - r, Math.min(1 - g, 1 - b))
        if (k == 1) {
          c = m = yl = 0
        } else {
          c = (1 - r - k) / (1 - k)
          m = (1 - g - k) / (1 - k)
          yl = (1 - b - k) / (1 - k)
        }

        if (channel == 3) {
          mod.data[offset] = mod.data[offset + 1] = mod.data[offset + 2] = 255 - byteRange(k * 255);
        } else {
          mod.data[offset] = byteRange(c * 255);
          mod.data[offset + 1] = byteRange(m * 255);
          mod.data[offset + 2] = byteRange(yl * 255);

          mod.data[offset] = mod.data[offset + 1] = mod.data[offset + 2] = 255 - mod.data[offset + channel];
        }
        mod.data[offset + 3] = 255;
      }
    }
  }
  context.putImageData(mod, 0, 0);
}
const byteRange = (a: number) => {
  if (a > 255) {
    a = 255
  }
  if (a < 0) {
    a = 0
  }
  return Math.floor(a)
}
</script>

<template>
  <section id="plotter-config">
    <aside>
      <SourceSelector v-model="imageSource"/>
      <SelectorImage
        v-show="imageSource === 'image'"
        @image-data-ready="processImage"
        />
      <AlgorithmsSection
        v-if="['image', 'webcam'].includes(imageSource) && config.imgData"
        @select-algo="loadWorker"
        @change-color-mode="changeColorMode"
        />
      <AlgorithmSliders
        v-if="config.imgData"
        :sliders="algoControls"
        @params-update="processImage"
        />
    </aside>
    <main :class="{ loading }">
      <div id="debug"></div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        :width="canvasSize.width"
        :height="canvasSize.height"
        :viewBox="`0 0 ${canvasSize.width} ${canvasSize.height}`"
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
