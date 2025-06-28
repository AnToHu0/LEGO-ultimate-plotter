import { reactive, ref } from 'vue';
import { legoHubService } from './LegoHubService';
import { motorService } from './MotorService';
import type { HubEventData } from './types';
import { HubEventType } from './types';

/**
 * Центральный контроллер для управления хабом LEGO
 * Координирует работу LegoHubService и MotorService
 */
class HubController {
  // Состояние подключения (делегируем к legoHubService)
  public get isConnected() { return legoHubService.isConnected; }
  public get isConnecting() { return legoHubService.isConnecting; }
  public get connectedDeviceName() { return legoHubService.connectedDeviceName; }
  public get error() { return legoHubService.error; }
  public get isDriverLoading() { return legoHubService.isDriverLoading; }

  // Состояние моторов (делегируем к motorService)
  public get xSpeed() { return motorService.currentXSpeed; }
  public get ySpeed() { return motorService.currentYSpeed; }
  public get isMotorActive() { return motorService.isActive; }

  // Состояние пера (делегируем к motorService)
  public get isPenDown() { return motorService.isPenDown; }

  // Регистр событий хаба
  private eventListeners = reactive<Record<string, Array<(data: HubEventData) => void>>>({});

  // Статус последнего сообщения от хаба
  public hubStatus = ref<string>('Disconnected');
  public lastMessage = ref<string>('');

  /**
   * Инициализация контроллера
   */
  constructor() {
    // Настраиваем обработчик для событий хаба
    this.setupHubEventHandling();

    // Подписываемся на события хаба
    this.setupStatusTracking();
  }

  /**
   * Настройка обработки событий хаба
   * В будущем можно расширить для обработки различных команд от хаба
   */
  private setupHubEventHandling(): void {
    // Здесь можно добавить перехват событий из stdout хаба
    // и их маршрутизацию в соответствующие обработчики
  }

  /**
   * Настройка отслеживания статуса хаба
   */
  private setupStatusTracking(): void {
    // Отслеживаем изменения состояния соединения через
    // проверку в интервале (т.к. нет подписок для ref)
    const checkConnection = () => {
      if (this.isConnected.value) {
        this.hubStatus.value = 'Connected';
      } else {
        this.hubStatus.value = 'Disconnected';
      }
    };

    // Начальная проверка
    checkConnection();

    // Устанавливаем интервал для проверки
    setInterval(checkConnection, 1000);

    // Отслеживаем сообщения от REPL
    legoHubService.onStdout((message: string) => {
      this.lastMessage.value = message;

      if (message.includes('READY')) {
        this.hubStatus.value = 'Ready';
      } else if (message.includes('OK:')) {
        this.hubStatus.value = 'Command Successful';
      } else if (message.includes('ERROR:')) {
        this.hubStatus.value = 'Command Failed';
      }
    });
  }

  /**
   * Подписка на события хаба
   * @param eventName Имя события
   * @param callback Функция обратного вызова
   */
  public on(eventName: string, callback: (data: HubEventData) => void): void {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Отписка от событий хаба
   * @param eventName Имя события
   * @param callback Функция обратного вызова
   */
  public off(eventName: string, callback: (data: HubEventData) => void): void {
    if (!this.eventListeners[eventName]) return;

    this.eventListeners[eventName] = this.eventListeners[eventName]
      .filter(listener => listener !== callback);
  }

  /**
   * Вызов события
   * @param data Данные события
   */
  private emit(data: HubEventData): void {
    const eventName = data.type;
    if (!this.eventListeners[eventName]) return;

    // Примеры использования HubEventType для проверки типа события
    if (data.type === HubEventType.MOTOR_MOVE ||
      data.type === HubEventType.MOTOR_STOP ||
      data.type === HubEventType.ERROR) {
      // Дополнительная обработка для определенных типов событий
    }

    this.eventListeners[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for "${eventName}":`, error);
      }
    });
  }

  /**
   * Подключение к хабу
   */
  public async connect(): Promise<void> {
    await legoHubService.scanAndConnect();
  }

  /**
   * Отключение от хаба
   */
  public disconnect(): void {
    // Не пытаемся останавливать моторы - это может вызвать ошибку GATT
    // Просто отключаемся от хаба, все остальное будет сброшено автоматически
    legoHubService.disconnect();
  }

  /**
   * Установка скоростей моторов
   */
  public async setMotorSpeeds(xSpeed: number, ySpeed: number): Promise<void> {
    if (legoHubService.isDriverLoading) {
      console.warn("Cannot control motors while driver is loading");
      return;
    }
    await motorService.setMotorSpeeds(xSpeed, ySpeed);
  }

  /**
   * Остановка всех моторов
   */
  public async stopAllMotors(): Promise<void> {
    if (legoHubService.isDriverLoading) {
      console.warn("Cannot control motors while driver is loading");
      return;
    }
    await motorService.stopAllMotors();
  }

  /**
   * Поднять перо
   */
  public async penUp(): Promise<void> {
    if (legoHubService.isDriverLoading) {
      console.warn("Cannot control pen while driver is loading");
      return;
    }
    await motorService.penUp();
  }

  /**
   * Опустить перо
   */
  public async penDown(): Promise<void> {
    if (legoHubService.isDriverLoading) {
      console.warn("Cannot control pen while driver is loading");
      return;
    }
    await motorService.penDown();
  }

  /**
   * Тестирование работы моторов напрямую
   */
  public async testMotors(): Promise<void> {
    console.log("Testing motors directly");
    if (!legoHubService.isConnected.value) {
      console.error("Cannot test motors: Not connected");
      this.emit({ type: HubEventType.ERROR, payload: "Not connected to hub" });
      return;
    }

    try {
      // Проверка состояния хаба
      console.log("Checking hub status before testing");
      this.emit({ type: HubEventType.STDOUT, payload: "Checking hub status" });

      // Выполним простую команду вывода для проверки REPL
      await legoHubService.sendReplCommand("print('Testing REPL connection')");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Прямое управление светодиодом - красный
      this.emit({ type: HubEventType.STDOUT, payload: "Testing hub LED - RED" });
      console.log("Setting hub LED to RED");
      await legoHubService.sendReplCommand("hub.light.on(Color.RED)");
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, доступны ли моторы
      console.log("Testing motor variables existence");
      await legoHubService.sendReplCommand("print('Motor X exists:', 'motor_x' in globals())");
      await new Promise(resolve => setTimeout(resolve, 500));
      await legoHubService.sendReplCommand("print('Motor Y exists:', 'motor_y' in globals())");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Пробуем переинициализировать моторы напрямую
      console.log("Reinitializing motors");
      await legoHubService.sendReplCommand("try:\n    motor_x = Motor(Port.B)\n    print('Motor X reinitialized')\nexcept Exception as e:\n    print('Error motor X:', e)");
      await new Promise(resolve => setTimeout(resolve, 500));

      await legoHubService.sendReplCommand("try:\n    motor_y = Motor(Port.A)\n    print('Motor Y reinitialized')\nexcept Exception as e:\n    print('Error motor Y:', e)");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Прямое управление мотором X - упрощенная последовательность
      this.emit({ type: HubEventType.STDOUT, payload: "Testing motor X - speed 30" });
      console.log("Testing motor X with speed 30");
      await legoHubService.sendReplCommand("try:\n    motor_x.dc(30)\n    print('Motor X started with speed 30')\nexcept Exception as e:\n    print('Error controlling motor X:', e)");
      await new Promise(resolve => setTimeout(resolve, 1500));

      await legoHubService.sendReplCommand("try:\n    motor_x.dc(0)\n    print('Motor X stopped')\nexcept Exception as e:\n    print('Error stopping motor X:', e)");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Прямое управление мотором Y - упрощенная последовательность
      this.emit({ type: HubEventType.STDOUT, payload: "Testing motor Y - speed 30" });
      console.log("Testing motor Y with speed 30");
      await legoHubService.sendReplCommand("try:\n    motor_y.dc(30)\n    print('Motor Y started with speed 30')\nexcept Exception as e:\n    print('Error controlling motor Y:', e)");
      await new Promise(resolve => setTimeout(resolve, 1500));

      await legoHubService.sendReplCommand("try:\n    motor_y.dc(0)\n    print('Motor Y stopped')\nexcept Exception as e:\n    print('Error stopping motor Y:', e)");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Возвращаем зеленый цвет
      await legoHubService.sendReplCommand("try:\n    hub.light.on(Color.GREEN)\n    print('LED set to GREEN')\nexcept Exception as e:\n    print('Error setting LED:', e)");

      this.emit({ type: HubEventType.STDOUT, payload: "Motor test completed" });
    } catch (error) {
      console.error("Error testing motors:", error);
      this.emit({ type: HubEventType.ERROR, payload: `Error testing motors: ${error}` });
    }
  }

  /**
   * Простой тест хаба - только светодиод
   */
  public async testHubLed(): Promise<void> {
    console.log("Testing hub LED only");
    if (!legoHubService.isConnected.value) {
      console.error("Cannot test hub: Not connected");
      this.emit({ type: HubEventType.ERROR, payload: "Not connected to hub" });
      return;
    }

    try {
      // Проверка состояния хаба
      console.log("Testing hub LED sequence");
      this.emit({ type: HubEventType.STDOUT, payload: "Running LED test" });

      // Тест красного светодиода
      await legoHubService.sendReplCommand("print('Setting LED to RED')");
      await legoHubService.sendReplCommand("hub.light.on(Color.RED)");
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Тест синего светодиода
      await legoHubService.sendReplCommand("print('Setting LED to BLUE')");
      await legoHubService.sendReplCommand("hub.light.on(Color.BLUE)");
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Тест зеленого светодиода
      await legoHubService.sendReplCommand("print('Setting LED to GREEN')");
      await legoHubService.sendReplCommand("hub.light.on(Color.GREEN)");
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Тест желтого светодиода
      await legoHubService.sendReplCommand("print('Setting LED to YELLOW')");
      await legoHubService.sendReplCommand("hub.light.on(Color.YELLOW)");
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Возвращаем зеленый для индикации завершения
      await legoHubService.sendReplCommand("hub.light.on(Color.GREEN)");

      this.emit({ type: HubEventType.STDOUT, payload: "LED test completed" });
    } catch (error) {
      console.error("Error testing hub LED:", error);
      this.emit({ type: HubEventType.ERROR, payload: `Error testing hub LED: ${error}` });
    }
  }
}

// Экспортируем экземпляр контроллера для использования во всем приложении
export const hubController = new HubController();
