import { EventEmitter } from "node:events"

export type AppServerEvent = {
  type?: string
  method?: string
  params?: unknown
  [key: string]: unknown
}

type EventBusEvents = {
  "app-server-event": [AppServerEvent]
  "debug-event": [AppServerEvent]
}

class TypedEventBus extends EventEmitter {
  emit<EventName extends keyof EventBusEvents>(eventName: EventName, ...args: EventBusEvents[EventName]) {
    return super.emit(eventName, ...args)
  }

  on<EventName extends keyof EventBusEvents>(eventName: EventName, listener: (...args: EventBusEvents[EventName]) => void) {
    return super.on(eventName, listener)
  }

  once<EventName extends keyof EventBusEvents>(eventName: EventName, listener: (...args: EventBusEvents[EventName]) => void) {
    return super.once(eventName, listener)
  }

  off<EventName extends keyof EventBusEvents>(eventName: EventName, listener: (...args: EventBusEvents[EventName]) => void) {
    return super.off(eventName, listener)
  }
}

export const eventBus = new TypedEventBus()
