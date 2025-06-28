/**
 * Типы для сервисов LEGO Hub
 */

/**
 * Данные для событий хаба
 */
export interface HubEventData {
  type: string;
  payload?: unknown;
}

/**
 * Типы событий хаба
 */
export enum HubEventType {
  MOTOR_MOVE = 'MOTOR_MOVE',
  MOTOR_STOP = 'MOTOR_STOP',
  HUB_CONNECT = 'HUB_CONNECT',
  HUB_DISCONNECT = 'HUB_DISCONNECT',
  ERROR = 'ERROR',
  STDOUT = 'STDOUT',
}

/**
 * Направление движения моторов
 */
export enum MotorDirection {
  CLOCKWISE = 'CLOCKWISE',
  COUNTERCLOCKWISE = 'COUNTERCLOCKWISE'
}

/**
 * Настройки мотора
 */
export interface MotorSettings {
  speed: number;
  direction: MotorDirection;
  port: string;
}

/**
 * Данные о движении моторов
 */
export interface MotorMoveData {
  xSpeed: number;
  ySpeed: number;
  timestamp: number;
}

/**
 * Состояние подключения хаба
 */
export interface HubConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  error: string | null;
}

/**
 * Команды Pybricks для REPL
 */
export enum PybricksReplCommand {
  MOVE = 'move',
  STOP_ALL = 'stop_all',
  PEN_UP = 'pen_up',
  PEN_DOWN = 'pen_down',
}
