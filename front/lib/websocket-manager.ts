import { toast } from "sonner"
import { config } from '@/config'

type WebSocketCallback = (data: Blob) => void
type CleanupCallback = () => void

interface WebSocketConnection {
  ws: WebSocket
  callbacks: Set<WebSocketCallback>
  retryCount: number
  reconnectTimeout?: NodeJS.Timeout
  isMonitoring: boolean
}

class WebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map()
  private maxRetries = 3

  startMonitoring(monitorId: number, onFrame: WebSocketCallback): CleanupCallback {
    const key = `/ws/monitor-tasks/${monitorId}`
    
    if (this.connections.has(key)) {
      const connection = this.connections.get(key)!
      connection.callbacks.add(onFrame)
      return () => {
        connection.callbacks.delete(onFrame)
      }
    }

    const ws = new WebSocket(`${config.wsUrl}${key}`)
    const connection: WebSocketConnection = {
      ws,
      callbacks: new Set([onFrame]),
      retryCount: 0,
      isMonitoring: true
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ token: localStorage.getItem('token') }))
      connection.retryCount = 0
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout)
        connection.reconnectTimeout = undefined
      }
    }

    ws.onmessage = (event) => {
      if (connection.callbacks.size > 0) {
        connection.callbacks.forEach(callback => callback(event.data))
      }
    }

    ws.onerror = () => {
      if (connection.isMonitoring) {
        this.handleMonitorError(key)
      }
    }

    ws.onclose = () => {
      if (connection.isMonitoring) {
        connection.reconnectTimeout = setTimeout(
          () => this.reconnectMonitor(key), 
          1000 * Math.pow(2, connection.retryCount)
        )
      }
    }

    this.connections.set(key, connection)
    return () => {
      connection.callbacks.delete(onFrame)
    }
  }

  stopMonitoring(monitorId: number) {
    const key = `/ws/monitor-tasks/${monitorId}`
    const connection = this.connections.get(key)
    if (connection) {
      connection.isMonitoring = false
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout)
      }
      if (connection.ws.readyState === WebSocket.OPEN || 
          connection.ws.readyState === WebSocket.CONNECTING) {
        connection.ws.close()
      }
      this.connections.delete(key)
    }
  }

  private handleMonitorError(key: string) {
    const connection = this.connections.get(key)
    if (connection && connection.isMonitoring) {
      connection.retryCount++
      toast.error('监控连接出错，正在重试...')
    }
  }

  private reconnectMonitor(key: string) {
    const connection = this.connections.get(key)
    if (connection && connection.isMonitoring) {
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout)
      }
      const callbacks = connection.callbacks
      this.connections.delete(key)
      
      const ws = new WebSocket(`${config.wsUrl}${key}`)
      const newConnection: WebSocketConnection = {
        ws,
        callbacks,
        retryCount: connection.retryCount + 1,
        isMonitoring: true
      }
      this.connections.set(key, newConnection)
    }
  }

  subscribe(key: string, onMessage: WebSocketCallback): CleanupCallback {
    if (!this.connections.has(key)) {
      this.createConnection(key)
    }

    const connection = this.connections.get(key)!
    connection.callbacks.add(onMessage)

    return () => {
      const conn = this.connections.get(key)
      if (conn) {
        conn.callbacks.delete(onMessage)
        if (conn.callbacks.size === 0) {
          conn.ws.onmessage = (event) => {
          }
        }
      }
    }
  }

  private createConnection(key: string) {
    if (this.connections.has(key)) {
      this.closeConnection(key)
    }

    const ws = new WebSocket(`${config.wsUrl}${key}`)
    const connection: WebSocketConnection = {
      ws,
      callbacks: new Set(),
      retryCount: 0
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ token: localStorage.getItem('token') }))
      connection.retryCount = 0
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout)
        connection.reconnectTimeout = undefined
      }
    }

    ws.onmessage = (event) => {
      if (connection.callbacks.size > 0) {
        connection.callbacks.forEach(callback => callback(event.data))
      } else {
      }
    }

    ws.onerror = () => {
      this.handleError(key)
    }

    ws.onclose = () => {
      if (connection.retryCount < this.maxRetries) {
        connection.reconnectTimeout = setTimeout(
          () => this.reconnect(key), 
          1000 * Math.pow(2, connection.retryCount)
        )
      }
    }

    this.connections.set(key, connection)
  }

  private handleError(key: string) {
    const connection = this.connections.get(key)
    if (connection) {
      connection.retryCount++
      if (connection.retryCount >= this.maxRetries) {
        toast.error('WebSocket 连接失败')
        this.closeConnection(key)
      }
    }
  }

  private reconnect(key: string) {
    const connection = this.connections.get(key)
    if (connection) {
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout)
        connection.reconnectTimeout = undefined
      }
      this.createConnection(key)
    }
  }

  private closeConnection(key: string) {
    const connection = this.connections.get(key)
    if (connection) {
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout)
      }
      if (connection.ws.readyState === WebSocket.OPEN || 
          connection.ws.readyState === WebSocket.CONNECTING) {
        connection.ws.close()
      }
      this.connections.delete(key)
    }
  }
}

export const wsManager = new WebSocketManager() 