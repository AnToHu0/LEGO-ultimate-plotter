<script lang="ts" setup>
import type { WorkerOption } from '@/types';
defineProps<{ sliders: WorkerOption[] }>()

const emit = defineEmits<{
  (event: 'params-update'): void,
}>()

const handleChange = (item: WorkerOption) => {
  if (item.type === 'range' && typeof item.value === 'string') {
    item.value = parseFloat(item.value) || 0;
  }
  console.log('%cSlider changed', 'color: orange; font-weight: bold', {
    label: item.label,
    value: item.type === 'checkbox' ? item.checked : item.value,
    type: typeof item.value
  });
  emit('params-update')
}

</script>

<template>
  <div id="sliders">
    <div v-for="item of sliders" :key="item.label" class="line">
      <label>
        <input
          v-if="item.type === 'checkbox'"
          type="checkbox"
          v-model="item.checked"
          @change="handleChange(item)"
          >
        {{ item.label }}
      </label>
      <input
        v-if="item.type === 'range'"
        :min="item.min"
        :max="item.max"
        :step='item.step || 1'
        v-model.number='item.value'
        type="range"
        @input="handleChange(item)"
        >
      <input
        v-if="item.type === 'range'"
        v-model.number="item.value"
        type="text"
        pattern="-?[0-9]+.?[0-9]*"
        @input="handleChange(item)"
        >

      <select v-if="item.type === 'select'" v-model="item.value" @change="handleChange(item)">
        <option v-for="option in item.options" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </div>
  </div>
</template>

<style lang="less" scoped>
#sliders {
  padding: 0 20px;
  .line {
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 0 20px;
    input {
      display: block;
      flex: 1 1 auto;
      &[type=text] {
        max-width: 50px;
        border: 1px solid @borders;
        padding: 2px;
        text-align: center;
        color: @text;
        flex: 0 1 auto;
      }
      &[type=range],
      &[type=checkbox] {
        cursor: pointer;
      }
      &[type=range] {
        margin: 7px 0;
        max-width: calc(100% - 70px);
        flex: 0 1 auto;
      }
    }
    &:has(select) {
      label {
        flex: 0 1 auto;
      }
    }
    label {
      cursor: default;
      flex: 1 1 100%;
      display: flex;
      gap: 10px;
      justify-content: start;
      text-decoration: none;
      input {
        flex: 0 1 auto;
      }
    }
  }
}

select {
  color: @text;
}
</style>
