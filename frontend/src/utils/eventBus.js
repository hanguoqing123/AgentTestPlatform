// 简单的事件总线，用于页面间通信
class EventBus {
  constructor() {
    this.events = {}
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = []
    }
    this.events[eventName].push(callback)
    
    // 返回取消订阅函数
    return () => {
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback)
    }
  }

  emit(eventName, data) {
    if (this.events[eventName]) {
      this.events[eventName].forEach(callback => callback(data))
    }
  }
}

export default new EventBus()
