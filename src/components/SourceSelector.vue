<script setup lang="ts">
import { defineProps, defineEmits } from "vue";
import type { SourceTabs } from '@/types/index'

defineProps<{ modelValue: SourceTabs }>()

const emit = defineEmits<{ (event: 'update:modelValue', source: SourceTabs): void }>()

const updateTab = (name: SourceTabs) => {
  emit('update:modelValue', name)
}
</script>

<template>
  <div class="src">
    <div class="source-select">
      <div @click='updateTab("image")' class="tab" :class="{ active: modelValue === 'image' }">Img</div>
      <div @click='updateTab("webcam")' class="tab" :class="{ active: modelValue === 'webcam' }">Webcam</div>
      <div @click='updateTab("text")' class="tab" :class="{ active: modelValue === 'text' }">Text</div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.source-select {
  padding: 20px 20px 0;
  display: flex;
  gap: 5px;
  border-bottom: 1px solid @borders;
  .tab {
    padding: 5px 10px;
    border: 1px solid @borders;
    border-bottom: none;
    border-radius: 5px 5px 0 0;
    cursor: pointer;
    user-select: none;
    &.active {
      background-color: @text;
      color: #fff;
    }
  }
}
</style>
