import { ref, computed } from "vue";
import {
  PYBRICKS_SERVICE_UUID,
  PYBRICKS_CONTROL_EVENT_UUID,
  // PYBRICKS_HUB_CAPABILITIES_UUID, // Пока не используем
  PybricksCommand,
  PybricksEvent,
  // PybricksStatus, // Пока не используем
  // HubCapability, // Пока не используем
} from "./constants";
import type { HubConnectionState } from "./types";

// Определения типов для Web Bluetooth API
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
    };
  }

  interface RequestDeviceOptions {
    filters?: Array<{
      namePrefix?: string;
      name?: string;
      manufacturerData?: Array<{ companyIdentifier: number; dataPrefix: BufferSource }>;
      serviceData?: Array<{ service: BluetoothServiceUUID; dataPrefix: BufferSource }>;
      services?: Array<BluetoothServiceUUID>;
    }>;
    optionalServices?: Array<BluetoothServiceUUID>;
    acceptAllDevices?: boolean;
  }

  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
    addEventListener(
      type: "gattserverdisconnected",
      listener: (this: this, ev: Event) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener(
      type: "gattserverdisconnected",
      listener: (this: this, ev: Event) => void,
      options?: boolean | EventListenerOptions
    ): void;
  }

  interface BluetoothRemoteGATTServer {
    device: BluetoothDevice;
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
  }

  interface BluetoothRemoteGATTService {
    device: BluetoothDevice;
    uuid: string;
    isPrimary: boolean;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    service: BluetoothRemoteGATTService;
    uuid: string;
    properties: BluetoothCharacteristicProperties;
    value?: DataView;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothCharacteristicProperties {
    broadcast: boolean;
    read: boolean;
    writeWithoutResponse: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
    authenticatedSignedWrites: boolean;
    reliableWrite: boolean;
    writableAuxiliaries: boolean;
  }

  type BluetoothServiceUUID = string | number;
  type BluetoothCharacteristicUUID = string | number;
}

// Удаляем старый массив, будем использовать PYBRICKS_SERVICE_UUID
// const POSSIBLE_PYBRICKS_SERVICE_UUIDS = [...];

export class LegoHubService {
  // Состояние
  private _state = ref<HubConnectionState>({
    isConnected: false,
    isConnecting: false,
    deviceName: null,
    error: null
  });

  // Геттеры для состояния - важно возвращать одни и те же ref, а не создавать новые
  public readonly isConnected = computed(() => this._state.value.isConnected);
  public readonly isConnecting = computed(() => this._state.value.isConnecting);
  public readonly connectedDeviceName = computed(() => this._state.value.deviceName);
  public readonly error = computed(() => this._state.value.error);

  // Приватные сеттеры для внутреннего использования
  private setIsConnected(value: boolean): void {
    this._state.value.isConnected = value;
  }

  private setIsConnecting(value: boolean): void {
    this._state.value.isConnecting = value;
  }

  private setConnectedDeviceName(value: string | null): void {
    this._state.value.deviceName = value;
  }

  private setError(value: string | null): void {
    this._state.value.error = value;
  }

  // Устройство и соединение
  hub = ref<BluetoothDevice | null>(null);
  server = ref<BluetoothRemoteGATTServer | null>(null);
  pybricksControlCharacteristic = ref<BluetoothRemoteGATTCharacteristic | null>(null);

  // Обработчики для stdout сообщений
  private stdoutListeners: Array<(message: string) => void> = [];

  // Очередь команд для Bluetooth
  private commandQueue: Array<() => Promise<void>> = [];
  private processingQueue = false;
  private isFunctionsReady = ref(false);
  private isLoadingDriver = ref(false);

  // Сканирование и подключение к устройству
  async scanAndConnect(): Promise<void> {
    if (!navigator.bluetooth) {
      this.setError("Bluetooth is not supported by your browser");
      return;
    }

    this.setIsConnecting(true);
    this.setError(null);

    try {
      // Запрашиваем устройство через диалог Bluetooth
      const device = await navigator.bluetooth.requestDevice({
        // Фильтруем по основному сервису Pybricks
        filters: [
          { services: [PYBRICKS_SERVICE_UUID] },
          // Дополнительные фильтры по имени для удобства пользователя
          { namePrefix: "Pybricks" },
          { namePrefix: "LEGO" },
        ],
        optionalServices: [
          PYBRICKS_SERVICE_UUID // Явно указываем основной сервис
        ]
      });

      // Сохраняем имя устройства
      this.setConnectedDeviceName(device.name || "Unknown device");

      // Добавляем обработчик отключения
      device.addEventListener("gattserverdisconnected", this.handleDisconnect.bind(this));

      // Подключаемся к GATT серверу
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("Failed to connect to GATT server");
      }

      // Сохраняем устройство и сервер
      this.hub.value = device;
      this.server.value = server;

      // Получаем основной сервис Pybricks
      const pybricksService = await server.getPrimaryService(PYBRICKS_SERVICE_UUID);

      // Получаем характеристику управления/событий
      this.pybricksControlCharacteristic.value = await pybricksService.getCharacteristic(PYBRICKS_CONTROL_EVENT_UUID);

      // Подписываемся на уведомления от характеристики управления/событий
      await this.pybricksControlCharacteristic.value.startNotifications();
      this.pybricksControlCharacteristic.value.addEventListener(
        "characteristicvaluechanged",
        this.handlePybricksEvent.bind(this)
      );

      // ВАЖНО: Устанавливаем состояние подключения ПЕРЕД вызовом startREPL
      this.setIsConnected(true);

      console.log("Successfully connected to Pybricks Hub");
      console.log("Connection state before startREPL:", this.isConnected.value);

      // Небольшая задержка для стабилизации соединения
      await new Promise(resolve => setTimeout(resolve, 500));

      // Запускаем REPL режим после успешного подключения
      await this.startREPL();

    } catch (error) {
      this.setError(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
      this.resetState();
    } finally {
      this.setIsConnecting(false);
    }
  }

  // Отключение от устройства
  async disconnect(): Promise<void> {
    try {
      if (this.server.value && this.server.value.connected) {
        // Останавливаем REPL режим перед отключением
        await this.stopREPL();

        // Отписываемся от уведомлений перед отключением
        if (this.pybricksControlCharacteristic.value) {
          try {
            await this.pybricksControlCharacteristic.value.stopNotifications();
          } catch (e) {
            console.warn("Failed to stop Pybricks notifications:", e);
          }
        }

        this.server.value.disconnect();
      }
    } catch (error) {
      console.error("Error during disconnect:", error);
    } finally {
      this.resetState();
    }
  }

  // Обработчик события отключения
  private handleDisconnect(): void {
    console.log("Device disconnected");
    this.resetState();
  }

  // Обработчик событий от Pybricks (stdout, status)
  private handlePybricksEvent(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    if (!value) return;

    const eventType: PybricksEvent = value.getUint8(0);

    switch (eventType) {
      case PybricksEvent.WRITE_STDOUT:
        const data = value.buffer.slice(1); // Получаем данные после первого байта (тип события)
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(data);
        console.log("Pybricks stdout:", text);

        // Оповещаем подписчиков о полученном сообщении
        this.notifyStdoutListeners(text);

        // Обработка ответов от хаба
        if (text.includes("OK:") || text.includes("ERROR:")) {
          this.processHubResponse(text);
        }
        break;

      case PybricksEvent.STATUS_REPORT:
        // Обработка статуса без неиспользуемых переменных
        // console.log("Pybricks status report received");
        break;

      default:
        console.warn("Unknown Pybricks event type:", eventType);
    }
  }

  // Оповещение подписчиков о сообщении в stdout
  private notifyStdoutListeners(message: string): void {
    // Проверяем сообщение о готовности функций
    if (message.includes("READY")) {
      console.log("Driver reported READY status");
      this.isFunctionsReady.value = true;
    }

    for (const listener of this.stdoutListeners) {
      try {
        listener(message);
      } catch (error) {
        console.error("Error in stdout listener:", error);
      }
    }
  }

  // Подписка на сообщения из stdout
  public onStdout(callback: (message: string) => void): void {
    this.stdoutListeners.push(callback);
  }

  // Отписка от сообщений stdout
  public offStdout(callback: (message: string) => void): void {
    this.stdoutListeners = this.stdoutListeners.filter(
      listener => listener !== callback
    );
  }

  // Обработка ответов от хаба
  private processHubResponse(response: string): void {
    const trimmedResponse = response.trim();

    if (trimmedResponse === "READY") {
      console.log("Hub is ready to accept commands");
    } else if (trimmedResponse.startsWith("OK:")) {
      const command = trimmedResponse.split(":")[1];
      console.log(`Command ${command} executed successfully`);
    } else if (trimmedResponse.startsWith("ERROR:")) {
      const parts = trimmedResponse.split(":");
      const command = parts[1];
      const errorMessage = parts.slice(2).join(":");
      console.error(`Error executing ${command}: ${errorMessage}`);
      this.setError(`Command error: ${errorMessage}`);
    }
  }

  // Отправка команды Pybricks
  async sendCommand(command: ArrayBuffer): Promise<void> {
    console.log("SendCommand called, connection state:", this.isConnected.value);
    console.log("Characteristic available:", !!this.pybricksControlCharacteristic.value);

    if (!this.pybricksControlCharacteristic.value || !this._state.value.isConnected) {
      console.error("Cannot send command: Not connected or characteristic not available.");
      return;
    }

    try {
      // Используем стандартный writeValue
      await this.pybricksControlCharacteristic.value.writeValue(command);
    } catch (error) {
      console.error("Failed to send command:", error);
      this.setError(`Failed to send command: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Отправка данных в stdin хаба
  async writeToStdin(data: string): Promise<void> {
    // Добавляем команду в очередь
    return new Promise<void>((resolve, reject) => {
      this.commandQueue.push(async () => {
        try {
          const textEncoder = new TextEncoder();
          const encodedData = textEncoder.encode(data);
          const command = new Uint8Array([PybricksCommand.WRITE_STDIN, ...encodedData]);
          await this.sendCommand(command.buffer);
          resolve();
        } catch (error) {
          console.error("Failed to send command:", error);
          reject(error);
        }
      });

      // Запускаем обработку очереди, если она еще не запущена
      this.processCommandQueue();
    });
  }

  // Обработка очереди команд
  private async processCommandQueue(): Promise<void> {
    if (this.processingQueue) return;

    this.processingQueue = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (command) {
        try {
          await command();
          // Добавляем небольшую задержку между командами
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error("Error processing command from queue:", error);
        }
      }
    }

    this.processingQueue = false;
  }

  // Запуск пользовательской программы (пример)
  async startUserProgram(): Promise<void> {
    const command = new Uint8Array([PybricksCommand.START_USER_PROGRAM]);
    await this.sendCommand(command.buffer);
  }

  // Остановка пользовательской программы (пример)
  async stopUserProgram(): Promise<void> {
    const command = new Uint8Array([PybricksCommand.STOP_USER_PROGRAM]);
    await this.sendCommand(command.buffer);
  }

  // Загрузка драйвера из файла
  async loadDriverFromFile(): Promise<void> {
    try {
      console.log("Loading driver from file...");

      // Получаем содержимое файла minimal-setup.py
      const response = await fetch('/hub/minimal-setup.py');
      if (!response.ok) {
        throw new Error(`Failed to fetch driver code: ${response.status} ${response.statusText}`);
      }

      // Получаем содержимое драйвера
      const driverCode = await response.text();
      console.log("Driver code fetched successfully, length:", driverCode.length);

      // Разбиваем код на строки
      const lines = driverCode.split('\n');
      console.log(`Processing driver code (${lines.length} lines)...`);

      // Группируем строки в блоки по 160 байт
      const blocks: string[] = [];
      let currentBlock = '';
      let inFunction = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Пропускаем пустые строки и комментарии
        if (line.trim() === '' || line.trim().startsWith('#')) {
          continue;
        }

        // Проверяем, начинается ли функция
        if (line.trim().startsWith('def ')) {
          // Если у нас есть накопленный блок, отправляем его
          if (currentBlock) {
            blocks.push(currentBlock);
            currentBlock = '';
          }

          // Начинаем новый блок с определением функции
          currentBlock = line;
          inFunction = true;
        }
        // Если мы внутри функции
        else if (inFunction) {
          // Проверяем, закончилась ли функция (отступ уменьшился)
          if (line.trim() !== '' && !line.startsWith('    ') && !line.startsWith('\t')) {
            // Функция закончилась, добавляем пустую строку и отправляем блок
            currentBlock += '\n';
            blocks.push(currentBlock);
            currentBlock = line;
            inFunction = false;
          } else {
            // Добавляем строку к текущему блоку
            currentBlock += '\n' + line;
          }
        }
        // Обычные строки (импорты, инициализация)
        else {
          // Проверяем, поместится ли строка в текущий блок
          const testBlock = currentBlock + (currentBlock ? '\n' : '') + line;
          if (testBlock.length > 160) {
            // Блок станет слишком большим, отправляем текущий и начинаем новый
            if (currentBlock) {
              blocks.push(currentBlock);
            }
            currentBlock = line;
          } else {
            // Добавляем к текущему блоку
            currentBlock = testBlock;
          }
        }
      }

      // Добавляем последний блок
      if (currentBlock) {
        blocks.push(currentBlock);
      }

      console.log(`Sending ${blocks.length} blocks...`);

      // Отправляем каждый блок
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        console.log(`Sending block ${i + 1}/${blocks.length} (${block.length} bytes):`);
        console.log(block);

        await this.sendReplCommand(block);

        // Пауза между блоками
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Даем время на обработку всех команд
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, что функции созданы
      console.log("Verifying driver initialization");
      await this.sendReplCommand("print('VERIFICATION: Functions loaded -', 'move' in globals(), 'stop_all' in globals())");
      await new Promise(resolve => setTimeout(resolve, 300));

      // Сигнал готовности
      await this.sendReplCommand("print('READY - Driver loaded successfully')");

      // Устанавливаем флаг готовности функций
      this.isFunctionsReady.value = true;
      console.log("Driver successfully loaded and initialized");
    } catch (error) {
      console.error("Failed to load driver from file:", error);
      this.setError(`Failed to load driver from file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Отправка команды в REPL
  async sendReplCommand(command: string): Promise<void> {
    if (!this.isConnected.value) {
      console.error("Cannot send REPL command: Not connected");
      return;
    }

    // Проверяем размер команды
    if (command.length > 160) {
      console.error(`Command too long: ${command.length} bytes (max 160)`);
      return;
    }

    console.log(`Sending REPL command (${command.length} bytes): "${command}"`);

    return new Promise<void>((resolve, reject) => {
      this.commandQueue.push(async () => {
        try {
          if (!this.isConnected.value || !this.pybricksControlCharacteristic.value) {
            console.error("Connection lost before sending REPL command");
            return;
          }

          const textEncoder = new TextEncoder();

          // Отправляем команду
          const commandBuffer = textEncoder.encode(command);
          await this.sendCommand(new Uint8Array([PybricksCommand.WRITE_STDIN, ...commandBuffer]).buffer);

          // Отправка символа новой строки для выполнения команды
          const newlineBuffer = textEncoder.encode("\r\n");
          await this.sendCommand(new Uint8Array([PybricksCommand.WRITE_STDIN, ...newlineBuffer]).buffer);

          // Даем системе время для обработки команды
          await new Promise(resolve => setTimeout(resolve, 100));

          resolve();
        } catch (error) {
          console.error("Failed to send REPL command:", error);
          reject(error);
        }
      });

      // Запускаем обработку очереди
      this.processCommandQueue();
    });
  }

  // Запуск REPL режима
  async startREPL(): Promise<void> {
    console.log("StartREPL called, connection state:", this.isConnected.value);
    console.log("Characteristic available:", !!this.pybricksControlCharacteristic.value);

    if (!this._state.value.isConnected || !this.pybricksControlCharacteristic.value) {
      console.error("Cannot start REPL: Not connected", {
        isConnected: this._state.value.isConnected,
        characteristic: !!this.pybricksControlCharacteristic.value
      });
      return;
    }

    try {
      // Отправка команды запуска REPL
      const command = new Uint8Array([PybricksCommand.START_REPL]);
      await this.sendCommand(command.buffer);
      console.log("REPL mode started");

      // Небольшая задержка перед загрузкой драйвера
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Загружаем драйвер из файла
      this.isLoadingDriver.value = true;
      await this.loadDriverFromFile();
      this.isLoadingDriver.value = false;
    } catch (error) {
      console.error("Failed to start REPL mode:", error);
      this.setError(`Failed to start REPL mode: ${error instanceof Error ? error.message : String(error)}`);
      this.isLoadingDriver.value = false;
    }
  }

  // Остановка REPL режима
  async stopREPL(): Promise<void> {
    if (!this.isConnected.value || !this.pybricksControlCharacteristic.value) {
      console.log("Cannot stop REPL: Not connected");
      return;
    }

    try {
      // Отправка команды остановки программы
      const command = new Uint8Array([PybricksCommand.STOP_USER_PROGRAM]);
      await this.sendCommand(command.buffer);
      console.log("REPL mode stopped");

      // Сбрасываем состояние функций
      this.isFunctionsReady.value = false;
    } catch (error) {
      console.error("Failed to stop REPL mode:", error);
    }
  }

  // Проверка готовности функций
  public get isFunctionsLoaded(): boolean {
    return this.isFunctionsReady.value;
  }

  // Загрузка кода драйвера
  async loadDriverCode(): Promise<void> {
    try {
      // Получаем содержимое файла driver.py
      const response = await fetch('/hub/driver.py');
      if (!response.ok) {
        throw new Error(`Failed to fetch driver code: ${response.status} ${response.statusText}`);
      }

      const driverCode = await response.text();

      // Отправляем код на хаб по частям
      await this.writeCodeBlock(driverCode);
      console.log("Driver code loaded");
    } catch (error) {
      console.error("Failed to load driver code:", error);
      this.setError(`Failed to load driver code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Отправка блока кода по частям (из-за ограничения BLE)
  async writeCodeBlock(code: string): Promise<void> {
    const CHUNK_SIZE = 18; // Размер части (меньше максимального размера пакета BLE)

    try {
      // Разбиваем код на строки для лучшей отладки
      const lines = code.split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue;

        // Удаляем отступы для корректной работы в REPL
        const trimmedLine = line.trimStart();

        // Отправляем строку частями, если она длинная
        for (let i = 0; i < trimmedLine.length; i += CHUNK_SIZE) {
          const chunk = trimmedLine.substring(i, i + CHUNK_SIZE);
          await this.writeToStdin(chunk);
          // Небольшая задержка для надежности
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Отправляем символ новой строки после каждой строки
        await this.writeToStdin('\r\n');
        // Задержка между строками для обработки
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error("Error writing code block:", error);
      throw error;
    }
  }

  // Проверка, загружается ли сейчас драйвер
  public get isDriverLoading(): boolean {
    return this.isLoadingDriver.value;
  }

  // Сброс состояния
  private resetState(): void {
    this._state.value = {
      isConnected: false,
      isConnecting: false,
      deviceName: null,
      error: this._state.value.error // Сохраняем текущую ошибку
    };

    this.isFunctionsReady.value = false;
    this.isLoadingDriver.value = false;
    this.hub.value = null;
    this.server.value = null;
    this.pybricksControlCharacteristic.value = null;
  }
}

// Экспортируем экземпляр сервиса для использования во всем приложении
export const legoHubService = new LegoHubService();
