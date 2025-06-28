import { ref } from 'vue';
import { legoHubService } from './LegoHubService';
import type { MotorMoveData } from './types';

/**
 * Сервис для управления моторами LEGO хаба
 */
export class MotorService {
  // Максимальная скорость мотора (0-100)
  private readonly MAX_SPEED = 50;

  // Текущие скорости моторов (реактивные для отображения в UI)
  public currentXSpeed = ref(0);
  public currentYSpeed = ref(0);

  // Состояние активности моторов
  public isActive = ref(false);

  // Состояние пера
  public isPenDown = ref(false);

  /**
   * Установка скоростей моторов
   */
  async setMotorSpeeds(xSpeed: number, ySpeed: number): Promise<void> {
    // Ограничиваем скорости
    xSpeed = Math.max(-this.MAX_SPEED, Math.min(this.MAX_SPEED, xSpeed));
    ySpeed = Math.max(-this.MAX_SPEED, Math.min(this.MAX_SPEED, ySpeed));

    // Записываем новые значения скоростей
    this.currentXSpeed.value = xSpeed;
    this.currentYSpeed.value = ySpeed;
    this.isActive.value = xSpeed !== 0 || ySpeed !== 0;

    try {
      // Отправляем команду в формате move(x, y)
      await legoHubService.sendReplCommand(`move(${xSpeed}, ${ySpeed})`);
    } catch (error) {
      console.error('Failed to set motor speeds:', error);
      // Не пробрасываем ошибку дальше, т.к. UI уже обновлен с новыми значениями
    }
  }

  /**
   * Остановка всех моторов
   */
  async stopAllMotors(): Promise<void> {
    try {
      await this.setMotorSpeeds(0, 0);
    } catch (error) {
      console.error('Failed to stop motors:', error);
    }
  }

  /**
   * Изменение скорости мотора по оси X
   * @param speed Скорость (-MAX_SPEED до MAX_SPEED)
   */
  public setXSpeed(speed: number): void {
    this.setMotorSpeeds(speed, this.currentYSpeed.value);
  }

  /**
   * Изменение скорости мотора по оси Y
   * @param speed Скорость (-MAX_SPEED до MAX_SPEED)
   */
  public setYSpeed(speed: number): void {
    this.setMotorSpeeds(this.currentXSpeed.value, speed);
  }

  /**
   * Получить текущие данные о движении моторов
   */
  public getCurrentMoveData(): MotorMoveData {
    return {
      xSpeed: this.currentXSpeed.value,
      ySpeed: this.currentYSpeed.value,
      timestamp: Date.now()
    };
  }

  /**
   * Поднять перо
   */
  async penUp(): Promise<void> {
    try {
      await legoHubService.sendReplCommand('pen_up()');
      this.isPenDown.value = false;
    } catch (error) {
      console.error('Failed to move pen up:', error);
    }
  }

  /**
   * Опустить перо
   */
  async penDown(): Promise<void> {
    try {
      await legoHubService.sendReplCommand('pen_down()');
      this.isPenDown.value = true;
    } catch (error) {
      console.error('Failed to move pen down:', error);
    }
  }
}

// Экспортируем экземпляр сервиса для использования во всем приложении
export const motorService = new MotorService();
