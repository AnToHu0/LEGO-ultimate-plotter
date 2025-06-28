<template>
  <div class="lego-hub-control">
    <div v-if="!hubController.isConnected.value" class="connect-container">
      <div class="guide-section">
        <button @click="showGuide = true" class="guide-button">
          Connection Guide
        </button>
      </div>
      <button
        @click="hubController.connect"
        :disabled="hubController.isConnecting.value"
        class="connect-button"
      >
        <span v-if="hubController.isConnecting.value">Connecting...</span>
        <span v-else>Connect Hub</span>
      </button>
      <div v-if="hubController.error.value" class="error-message">
        {{ hubController.error.value }}
      </div>
    </div>
    <div v-else class="hub-info">
      <!-- Отображение состояния загрузки драйвера -->
      <div v-if="isDriverLoading" class="driver-loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading driver...</div>
      </div>

      <div class="hub-name">
        <div class="status-dot connected"></div>
        {{ hubController.connectedDeviceName.value }}
      </div>

      <!-- Статус хаба -->
      <div class="hub-status">
        <div class="status-label">Status:</div>
        <div class="status-value">{{ hubController.hubStatus.value }}</div>
      </div>

      <!-- Последнее сообщение от хаба -->
      <div v-if="hubController.lastMessage.value" class="last-message">
        <div class="message-label">Last Message:</div>
        <div class="message-value">{{ hubController.lastMessage.value }}</div>
      </div>

      <!-- Кнопка для отладочного тестирования моторов -->
      <div class="button-group">
        <button
          @click="testMotors"
          class="test-button"
          :disabled="isDriverLoading"
        >
          Test Motors
        </button>

        <button
          @click="testHubLed"
          class="test-button led-test-button"
          :disabled="isDriverLoading"
        >
          Test LED
        </button>
      </div>

      <button @click="hubController.disconnect" class="disconnect-button">
        Disconnect
      </button>

      <!-- Компонент управления моторами, отображается только когда подключен хаб -->
      <MotorControl
        v-if="hubController.isConnected.value"
        :disabled="isDriverLoading"
      />
    </div>

    <ConnectionGuideModal :is-visible="showGuide" @close="showGuide = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { hubController } from '@/services/HubController';
import { legoHubService } from '@/services/LegoHubService';
import MotorControl from './MotorControl.vue';
import ConnectionGuideModal from './ConnectionGuideModal.vue';

const showGuide = ref(false);

// Состояние загрузки драйвера
const isDriverLoading = computed(() => legoHubService.isDriverLoading);

// Функция для прямого тестирования моторов
async function testMotors() {
  try {
    await hubController.testMotors();
  } catch (error) {
    console.error("Error testing motors:", error);
  }
}

// Функция для прямого тестирования LED
async function testHubLed() {
  try {
    await hubController.testHubLed();
  } catch (error) {
    console.error("Error testing LED:", error);
  }
}
</script>

<style scoped>
.lego-hub-control {
  height: 100%;
  border-left: 1px solid #e0e0e0;
  padding: 16px;
  width: 270px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  position: relative;
}

.driver-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 2s linear infinite;
  margin-bottom: 12px;
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.connect-button {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  width: 100%;
  transition: background-color 0.2s;
  margin-top: 10px;
}

.connect-button:hover:not(:disabled) {
  background-color: #45a049;
}

.connect-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.guide-section {
  margin-bottom: 16px;
  text-align: center;
}

.guide-button {
  background-color: transparent;
  color: #2196F3;
  border: none;
  border-bottom: 1px dashed #2196F3;
  padding: 5px 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}

.guide-button:hover {
  color: #0d8bf2;
}

.error-message {
  color: #D32F2F;
  margin-top: 8px;
  font-size: 14px;
}

.hub-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.status-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-dot.connected {
  background-color: #4CAF50;
  box-shadow: 0 0 5px #4CAF50;
}

.hub-name {
  font-weight: bold;
  display: flex;
  align-items: center;
  font-size: 16px;
}

.disconnect-button {
  background-color: #F44336;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 8px;
  transition: background-color 0.2s;
}

.disconnect-button:hover {
  background-color: #D32F2F;
}

.hub-status {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  background-color: #f9f9f9;
}

.status-label, .message-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
}

.status-value {
  font-weight: 500;
  color: #333;
}

.last-message {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  background-color: #f9f9f9;
  overflow: hidden;
}

.message-value {
  font-family: monospace;
  font-size: 12px;
  background-color: #f5f5f5;
  padding: 4px;
  border-radius: 3px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.test-button {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  flex: 1;
}

.test-button:hover {
  background-color: #0d8bf2;
}

.test-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.led-test-button {
  background-color: #9c27b0;
}

.led-test-button:hover {
  background-color: #7b1fa2;
}
</style>
