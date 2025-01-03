<script lang="ts" setup>
import { ref, watch, defineEmits, inject } from "vue";
import type { Config } from "@/types";

const config = inject<Config>('config')!

const algorithms = [
  {
    script: 'squiggle.js',
    name: 'Squiggle'
  },
  {
    script: 'squiggleLeftRight.js',
    name: 'Squiggle Left/Right'
  },
  {
    script: 'spiral.js',
    name: 'Spiral'
  },
  {
    script: 'polyspiral.js',
    name: 'Polygon Spiral'
  },
  {
    script: 'sawtooth.js',
    name: 'Sawtooth'
  },
  {
    script: 'delaunay.js',
    name: 'Delaunay'
  },
  {
    script: 'linedraw.js',
    name: 'Linedraw'
  },
  {
    script: 'mosaic.js',
    name: 'Mosaic'
  },
  {
    script: 'subline.js',
    name: 'Subline'
  },
  {
    script: 'springs.js',
    name: 'Springs'
  },
  {
    script: 'waves.js',
    name: 'Waves'
  },
  {
    script: 'needles.js',
    name: 'Needles'
  },
  {
    script: 'implode.js',
    name: 'Implode'
  },
  {
    script: 'halftone.js',
    name: 'Halftone'
  },
  {
    script: 'boxes.js',
    name: 'Boxes'
  },
  {
    script: 'dots.js',
    name: 'Dots'
  },
  {
    script: 'jaggy.js',
    name: 'Jaggy'
  },
  {
    script: 'longwave.js',
    name: 'Longwave'
  },
  {
    script: 'linescan.js',
    name: 'Linescan'
  }
]
const algorithm = ref(0)

const emit = defineEmits<{
  (event: 'select-algo', scriptName: string): void,
  (event: 'change-color-mode', mode: 'black' | 'cmyk'): void
}>()
watch(algorithm, () => {
  emit('select-algo', algorithms[algorithm.value].script)
})
emit('select-algo', algorithms[algorithm.value].script)

const colorMode = ref(config.mode)
watch(colorMode, () => {
  emit('change-color-mode', colorMode.value)
})

</script>
<template>
  <div id="algorithms">
    <div class="line">
      Color mode:
      <label>CMYK<input name='color' v-model='colorMode' value="cmyk" type="radio"></label>
      <label>B/W<input name='color' v-model='colorMode' value="black" type="radio"></label>
    </div>
    <div class="line">
      <label class="flex">
        Algorithm:
        <select v-model="algorithm">
          <option v-for="(item, i) of algorithms" :key="item.script" :value="i">{{ item.name }}</option>
        </select>
      </label>
    </div>
  </div>
</template>

<style lang="less" scoped>
.line {
  margin-bottom: 10px;
}
select {
  color: @text
}
</style>
