// SPDX-License-Identifier: MIT
// Copyright (c) 2023 The Pybricks Authors

/**
 * Основные константы для Bluetooth взаимодействия с Pybricks устройствами
 */

/** UUID сервиса Pybricks - уникальный идентификатор для обнаружения Pybricks устройств */
export const PYBRICKS_SERVICE_UUID = 'c5f50001-8280-46da-89f4-6d8051e4aeef';

/** UUID характеристики для управления и событий - используется для отправки команд и получения уведомлений */
export const PYBRICKS_CONTROL_EVENT_UUID = 'c5f50002-8280-46da-89f4-6d8051e4aeef';

/** UUID характеристики возможностей хаба - содержит информацию о поддерживаемых функциях */
export const PYBRICKS_HUB_CAPABILITIES_UUID = 'c5f50003-8280-46da-89f4-6d8051e4aeef';

/** Команды, которые можно отправить на хаб */
export enum PybricksCommand {
  /** Остановка пользовательской программы (v1.0.0) */
  STOP_USER_PROGRAM = 0,
  /** Запуск пользовательской программы (v1.2.0) */
  START_USER_PROGRAM = 1,
  /** Запуск интерактивного REPL (v1.2.0) */
  START_REPL = 2,
  /** Запись метаданных пользовательской программы (v1.2.0) */
  WRITE_USER_PROGRAM_META = 3,
  /** Запись в пользовательскую RAM (v1.2.0) */
  WRITE_USER_RAM = 4,
  /** Перезагрузка в режим обновления прошивки (v1.2.0) */
  RESET_IN_UPDATE_MODE = 5,
  /** Запись данных в stdin (v1.3.0) */
  WRITE_STDIN = 6
}

/** События, получаемые от хаба */
export enum PybricksEvent {
  /** Отчет о статусе - получается при включении уведомлений и при изменении статуса (v1.0.0) */
  STATUS_REPORT = 0,
  /** Хаб записал данные в stdout (v1.3.0) */
  WRITE_STDOUT = 1
}

/** Статусы, получаемые в отчетах о состоянии */
export enum PybricksStatus {
  /** Предупреждение о низком заряде батареи (v1.0.0) */
  BATTERY_LOW_WARNING = 0,
  /** Критически низкий заряд батареи, устройство выключается (v1.0.0) */
  BATTERY_CRITICAL_SHUTDOWN = 1,
  /** Слишком высокий ток батареи (v1.0.0) */
  BATTERY_HIGH_CURRENT = 2,
  /** BLE в режиме обнаружения (v1.0.0) */
  BLE_ADVERTISING = 3,
  /** Слабый сигнал BLE (v1.0.0) */
  BLE_LOW_SIGNAL = 4,
  /** Кнопка питания нажата (v1.0.0) */
  POWER_BUTTON_PRESSED = 5,
  /** Пользовательская программа запущена (v1.0.0) */
  USER_PROGRAM_RUNNING = 6,
  /** Хаб выключается (v1.1.0) */
  SHUTDOWN = 7
}

/** Флаги возможностей хаба */
export enum HubCapability {
  /** Хаб имеет интерактивный REPL (v1.2.0) */
  HAS_REPL = 1 << 0,
  /** Поддержка MultiMpy6 без нативных модулей (v1.2.0) */
  USER_PROGRAM_MULTI_MPY6 = 1 << 1,
  /** Поддержка MultiMpy6 с нативными модулями MPY ABI v6.1 (v1.3.0) */
  USER_PROGRAM_MULTI_MPY6_NATIVE = 1 << 2
}

/** Форматы файлов для прошивки */
export enum FileFormat {
  /** MicroPython .mpy файл версии 5 */
  MPY5 = 0,
  /** MicroPython .mpy файл версии 6 */
  MPY6 = 1,
  /** Pybricks multi-MicroPython .mpy файл версии 6 */
  MULTI_MPY6 = 2
}
