<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Connection Guide</h2>
        <button class="close-button" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <p>To work with the LEGO Hub in this plotter application, follow these steps:</p>

        <h3>Step 1: Flash your Hub with Pybricks</h3>
        <p>Your LEGO Hub needs to be flashed with Pybricks firmware. You can do this by visiting
          <a href="https://code.pybricks.com/" target="_blank" rel="noopener noreferrer">code.pybricks.com</a>.
        </p>

        <h3>Step 2: Upload the Plotter Driver</h3>
        <p>Download and upload the <a href="/hub/driver.py" download>plotter driver program</a> to your Hub using the Pybricks interface.</p>

        <h3>Step 3: Connect to the Hub</h3>
        <ol>
          <li>Click the "Connect Hub" button in this application</li>
          <li>Turn on your Hub by pressing its button</li>
          <li>Select your Hub from the device selection dialog that appears (similar to how you would in the Pybricks interface)</li>
        </ol>

        <p>Once connected, you will see your Hub's name displayed and you can start using the plotter.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isVisible: boolean
}>();

const emit = defineEmits<{
  (e: 'close'): void
}>();

function closeModal() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  width: 90%;
  max-width: 600px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.close-button:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  line-height: 1.5;
}

h3 {
  margin-top: 20px;
  margin-bottom: 10px;
}

ol {
  padding-left: 20px;
}

li {
  margin-bottom: 8px;
}

a {
  color: #2196F3;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
