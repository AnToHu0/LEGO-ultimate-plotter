<template>
  <div class="motor-control" :class="{ disabled }">
    <h3>Motor Control</h3>

    <div class="control-instructions">
      <p>Click this area and use arrow keys to control motors.</p>
      <p>Press Escape to stop all motors.</p>
    </div>

    <div
      class="control-area"
      tabindex="0"
      @keydown="handleKeyDown"
      @keyup="handleKeyUp"
      @blur="stopAllMotors"
      ref="controlArea"
      :class="{ disabled }"
    >
      <div class="control-visualizer">
        <div class="arrow-controls">
          <div
            class="arrow up"
            :class="{ active: pressedKeys.ArrowUp }"
            @mousedown="startArrowPress('ArrowUp')"
            @mouseup="stopArrowPress('ArrowUp')"
            @mouseleave="stopArrowPress('ArrowUp')"
          >↑</div>
          <div
            class="arrow left"
            :class="{ active: pressedKeys.ArrowLeft }"
            @mousedown="startArrowPress('ArrowLeft')"
            @mouseup="stopArrowPress('ArrowLeft')"
            @mouseleave="stopArrowPress('ArrowLeft')"
          >←</div>
          <div
            class="arrow down"
            :class="{ active: pressedKeys.ArrowDown }"
            @mousedown="startArrowPress('ArrowDown')"
            @mouseup="stopArrowPress('ArrowDown')"
            @mouseleave="stopArrowPress('ArrowDown')"
          >↓</div>
          <div
            class="arrow right"
            :class="{ active: pressedKeys.ArrowRight }"
            @mousedown="startArrowPress('ArrowRight')"
            @mouseup="stopArrowPress('ArrowRight')"
            @mouseleave="stopArrowPress('ArrowRight')"
          >→</div>
        </div>
      </div>

      <div class="speed-display">
        <div class="speed-axis">
          <span>X Speed:</span>
          <div class="speed-bar">
            <div
              class="speed-value"
              :style="{ width: `${Math.abs(hubController.xSpeed.value)}%`, marginLeft: hubController.xSpeed.value < 0 ? 0 : '50%', marginRight: hubController.xSpeed.value > 0 ? 0 : '50%' }"
              :class="{ negative: hubController.xSpeed.value < 0, positive: hubController.xSpeed.value > 0 }"
            ></div>
          </div>
          <span>{{ hubController.xSpeed.value }}</span>
        </div>
        <div class="speed-axis">
          <span>Y Speed:</span>
          <div class="speed-bar">
            <div
              class="speed-value"
              :style="{ width: `${Math.abs(hubController.ySpeed.value)}%`, marginLeft: hubController.ySpeed.value < 0 ? 0 : '50%', marginRight: hubController.ySpeed.value > 0 ? 0 : '50%' }"
              :class="{ negative: hubController.ySpeed.value < 0, positive: hubController.ySpeed.value > 0 }"
            ></div>
          </div>
          <span>{{ hubController.ySpeed.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { hubController } from '@/services/HubController';

// Свойства компонента
const props = defineProps<{
  disabled?: boolean;
}>();

// Состояние нажатых клавиш
const pressedKeys = reactive({
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false
});

// Ссылка на управляющую область
const controlArea = ref<HTMLElement | null>(null);

// Обработка нажатия стрелок мышью
async function startArrowPress(key: string) {
  if (props.disabled) return;

  if (key in pressedKeys && !pressedKeys[key as keyof typeof pressedKeys]) {
    pressedKeys[key as keyof typeof pressedKeys] = true;
    await updateMotorSpeeds();
    // Фокусируем область управления для возможности приема событий клавиатуры
    if (controlArea.value) {
      controlArea.value.focus();
    }
  }
}

// Обработка отпускания стрелок мышью
async function stopArrowPress(key: string) {
  if (props.disabled) return;

  if (key in pressedKeys && pressedKeys[key as keyof typeof pressedKeys]) {
    pressedKeys[key as keyof typeof pressedKeys] = false;
    await updateMotorSpeeds();
  }
}

// Обработка нажатия клавиш
async function handleKeyDown(event: KeyboardEvent) {
  if (props.disabled) return;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) {
    event.preventDefault();

    if (event.key === 'Escape') {
      await stopAllMotors();
      return;
    }

    // Если клавиша уже нажата, не обрабатываем повторное нажатие
    if (event.key in pressedKeys && pressedKeys[event.key as keyof typeof pressedKeys]) {
      return;
    }

    // Устанавливаем флаг нажатия клавиши
    if (event.key in pressedKeys) {
      pressedKeys[event.key as keyof typeof pressedKeys] = true;
      // Обновляем скорости моторов только когда изменилось состояние клавиши
      await updateMotorSpeeds();
    }
  }
}

// Обработка отпускания клавиш
async function handleKeyUp(event: KeyboardEvent) {
  if (props.disabled) return;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();

    // Если клавиша не была нажата, игнорируем
    if (event.key in pressedKeys && !pressedKeys[event.key as keyof typeof pressedKeys]) {
      return;
    }

    // Сбрасываем флаг нажатия клавиши
    if (event.key in pressedKeys) {
      pressedKeys[event.key as keyof typeof pressedKeys] = false;
      // Обновляем скорости моторов только когда изменилось состояние клавиши
      await updateMotorSpeeds();
    }
  }
}

// Обновление скоростей моторов на основе нажатых клавиш
async function updateMotorSpeeds() {
  if (props.disabled) return;

  // Расчет скорости по X (влево/вправо)
  let xSpeed = 0;
  if (pressedKeys.ArrowRight) xSpeed += 50;
  if (pressedKeys.ArrowLeft) xSpeed -= 50;

  // Расчет скорости по Y (вверх/вниз)
  let ySpeed = 0;
  if (pressedKeys.ArrowUp) ySpeed += 50;
  if (pressedKeys.ArrowDown) ySpeed -= 50;

  // Отправляем данные в контроллер хаба
  await hubController.setMotorSpeeds(xSpeed, ySpeed);
}

// Остановка всех моторов
async function stopAllMotors() {
  // Сбрасываем все флаги нажатий
  Object.keys(pressedKeys).forEach(key => {
    pressedKeys[key as keyof typeof pressedKeys] = false;
  });

  // Отправляем команду остановки через контроллер
  await hubController.stopAllMotors();
}

// Автоматически фокусируемся на области управления при монтировании
function focusControlArea() {
  if (controlArea.value && !props.disabled) {
    controlArea.value.focus();
  }
}

// Следим за состоянием подключения
watch(() => hubController.isConnected.value, (connected) => {
  if (connected && !props.disabled) {
    // Фокусируемся на области управления, когда подключились
    setTimeout(() => {
      focusControlArea();
    }, 500);
  } else {
    // Если отключились, просто сбрасываем состояние клавиш без отправки команд
    Object.keys(pressedKeys).forEach(key => {
      pressedKeys[key as keyof typeof pressedKeys] = false;
    });
  }
});

// Следим за состоянием блокировки
watch(() => props.disabled, (isDisabled) => {
  if (isDisabled) {
    stopAllMotors();
  } else if (hubController.isConnected.value) {
    setTimeout(() => {
      focusControlArea();
    }, 500);
  }
});
</script>

<style scoped>
.motor-control {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.motor-control.disabled {
  opacity: 0.6;
  pointer-events: none;
}

h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
}

.control-instructions {
  margin-bottom: 15px;
  font-size: 14px;
  color: #555;
}

.control-instructions p {
  margin: 5px 0;
}

.control-area {
  padding: 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.control-area:focus {
  border-color: #4CAF50;
}

.control-area.disabled {
  border-color: #eee;
  background-color: #f9f9f9;
  cursor: not-allowed;
}

.control-visualizer {
  margin-bottom: 20px;
}

.arrow-controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 120px;
  height: 120px;
  margin: 0 auto;
}

.arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #aaa;
  border-radius: 8px;
  transition: all 0.2s;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
  background-color: #f8f8f8;
}

.arrow:hover {
  background-color: #eaeaea;
  transform: scale(1.05);
}

.arrow:active {
  transform: scale(0.95);
}

.arrow.active {
  color: white;
  background-color: #4CAF50;
  transform: scale(1.1);
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2);
}

.arrow.up {
  grid-column: 2;
  grid-row: 1;
}

.arrow.left {
  grid-column: 1;
  grid-row: 2;
}

.arrow.down {
  grid-column: 2;
  grid-row: 3;
}

.arrow.right {
  grid-column: 3;
  grid-row: 2;
}

.speed-display {
  margin-top: 20px;
}

.speed-axis {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.speed-axis span {
  min-width: 60px;
  text-align: right;
  margin-right: 10px;
}

.speed-bar {
  flex-grow: 1;
  height: 20px;
  background-color: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.speed-bar::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  height: 80%;
  width: 1px;
  background-color: #999;
  transform: translateY(-50%);
}

.speed-value {
  height: 100%;
  transition: all 0.3s ease;
}

.speed-value.positive {
  background-color: #4CAF50;
}

.speed-value.negative {
  background-color: #F44336;
}
</style>
