<script setup lang="ts">
import type { Config } from "@/types";
import { ref, onMounted, watch, inject } from "vue";
import type { ComputedRef, Ref } from 'vue'

const config = inject<Config>('config')!
const canvasSize = inject<ComputedRef<{ width: number, height: number }>>('canvasSize')!

const orientation: Ref<'v' | 'h'> = ref(config.orientation)

watch(orientation, () => {
  if (config.img) {
    setTimeout(loadImage, 0)
  }
  config.orientation = orientation.value
})

const preview = ref<HTMLCanvasElement | null>(null)
const previewContext = ref<CanvasRenderingContext2D | null>(null)
onMounted(() => {
  if (preview.value) {
    previewContext.value = preview.value.getContext('2d');
  }
});

const draw = () => {
  if (!config.img) return
  previewContext.value!.clearRect(0, 0, canvasSize.value.width, canvasSize.value.height)
  previewContext.value!.drawImage(
    config.img,
    config.offset.x - config.scale * config.img.width * 0.5,
    config.offset.y - config.scale * config.img.height * 0.5,
    config.scale * config.img.width,
    config.scale * config.img.height)
}

function loadImage() {
  config.scale = Math.min(canvasSize.value.height / config.img!.height, canvasSize.value.width / config.img!.width)
  config.offset = { x: canvasSize.value.width / 2, y: canvasSize.value.height / 2 }
  draw()
}

const selectImage = () => {
  const allowedTypes = ['image/png', 'image/jpeg'];
  const d = document.createElement('input')
  d.type = 'file'
  d.accept = allowedTypes.join(', ')
  d.onchange = (e) => {
    if (!config.img) {
      config.img = new Image();
      config.img.onload = loadImage;
    }
    const input = e.target as HTMLInputElement;
    if (input?.files?.length && allowedTypes.includes(input.files[0].type)) {
      config.img.src = URL.createObjectURL(input.files[0]);
    }
  }
  d.click()
}


const emit = defineEmits<{ (event: 'image-data-ready', imgData: ImageData): void }>()

const imageCanvas = document.createElement('canvas')
imageCanvas.width = canvasSize.value.width
imageCanvas.height = canvasSize.value.height
const imageContext = imageCanvas.getContext('2d')

watch(canvasSize, () => {
  imageCanvas.width = canvasSize.value.width
  imageCanvas.height = canvasSize.value.height
})

const useImage = () => {
  if (!config.img) return
  if (!previewContext.value) return
  if (!preview.value) return
  imageContext!.fillStyle = '#fff'
  imageContext!.fillRect(0, 0, canvasSize.value.width, canvasSize.value.height)
  imageContext!.drawImage(preview.value, 0, 0)
  emit('image-data-ready', imageContext!.getImageData(0, 0, canvasSize.value.width, canvasSize.value.height))
}

// handling drag-n-drop

const handleDragOver = (e: DragEvent) => {
  e.stopPropagation();
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
}

const handleFileDrop = (e: DragEvent) => {
  e.stopPropagation();
  e.preventDefault();
  if (!e.dataTransfer) return

  const files = e.dataTransfer.files;
  //loadImage()
  if (!config.img) {
    config.img = new Image();
    config.img.onload = loadImage;
  }
  config.img.src = URL.createObjectURL(files[0]);
}

// image manipulations

const handleResize = (e: WheelEvent) => {
  const prevScale = config.scale
  config.scale *= e.deltaY > 0 ? 1.1 : 0.9;
  config.offset.x = ((config.offset.x - canvasSize.value.width / 2) / prevScale) * config.scale + canvasSize.value.width / 2
  config.offset.y = ((config.offset.y - canvasSize.value.height / 2) / prevScale) * config.scale + canvasSize.value.height / 2
  draw()
}

const handleImagePan = (e: MouseEvent) => {
  if (!preview.value) return
  let dx = e.clientX, dy = e.clientY
  const currentScale = canvasSize.value.width / preview.value.getBoundingClientRect().width

  document.onmousemove = function (e) {
    const x = e.clientX - dx, y = e.clientY - dy
    config.offset.x += x * currentScale
    config.offset.y += y * currentScale
    dx = e.clientX
    dy = e.clientY
    draw()
    return false
  }
  document.onmouseup = function () {
    document.onmousemove = null
    document.onmouseup = null
  }
  return false
}

</script>

<template>
  <div
    id=imgselect
    title="You can drag and drop images here"
    @dragover="handleDragOver"
    @drop="handleFileDrop"
    >
    <div class="line">
      Orientation:
      <label>Vertical<input name='orientation' v-model='orientation' value="v" type="radio"></label>
      <label>Horisontal<input name='orientation' v-model='orientation' value="h" type="radio"></label>
    </div>
    <div class="line">
      <canvas
        id='preview'
        :class="orientation"
        ref="preview"
        :width="canvasSize.width"
        :height="canvasSize.height"
        @wheel.prevent.stop="handleResize"
        @mousedown="handleImagePan"
        >
      </canvas>
    </div>
    <div class="line">
      <button class="btn" @click='selectImage'>Select image</button>
      <button class="btn" @click='useImage' :class="{ disabled: !config.img }">Use image</button>
    </div>
  </div>
</template>

<style lang="less" scoped>
canvas {
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
  &.v {
    aspect-ratio: calc(1 / 1.4142);
  }
}
#imgselect {
  padding: 10px 20px;
}
</style>
