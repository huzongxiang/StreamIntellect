'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { config } from '@/config'
import { cn } from '@/lib/utils'
import { wsManager } from '@/lib/websocket-manager'

interface MonitorTask {
  id: number
  task_id: number
  status: string
  task_name: string
  created_at: string
}

export default function MonitorPage() {
  const [monitors, setMonitors] = useState<MonitorTask[]>([])
  const [imageUrls, setImageUrls] = useState<{ [key: number]: string }>({})
  const [cleanupFns, setCleanupFns] = useState<{ [key: number]: () => void }>({})

  // 获取监控任务列表
  const fetchMonitors = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/monitor-tasks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        toast.error('获取监控列表失败')
        return
      }
      const data = await response.json()
      setMonitors(data)
    } catch (error) {
      toast.error('获取监控列表失败')
    }
  }

  useEffect(() => {
    fetchMonitors()
    // 定期刷新监控列表
    const interval = setInterval(fetchMonitors, 5000)
    return () => {
      clearInterval(interval)
      // 清理所有图片URL
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url))
      // 执行所有清理函数
      Object.values(cleanupFns).forEach(cleanup => cleanup())
    }
  }, [])

  // 监听monitors变化，自动为running状态的监控建立连接
  useEffect(() => {
    monitors.forEach(monitor => {
      if (monitor.status === 'running') {
        wsManager.startMonitoring(monitor.id, (data: Blob) => {
          if (imageUrls[monitor.id]) {
            URL.revokeObjectURL(imageUrls[monitor.id])
          }
          setImageUrls(prev => ({
            ...prev,
            [monitor.id]: URL.createObjectURL(data)
          }))
        })
      }
    })
  }, [monitors])

  // 组件卸载时只清理图片资源，不清理WebSocket连接
  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  // 启动监控
  const startMonitor = async (monitorId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/monitor-tasks/${monitorId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        throw new Error('启动监控任务失败')
      }

      // 建立 WebSocket 连接
      const ws = new WebSocket(`${config.wsUrl}/ws/monitor-tasks/${monitorId}`)
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ token: localStorage.getItem('token') }))
      }
      
      ws.onmessage = (event) => {
        if (imageUrls[monitorId]) {
          URL.revokeObjectURL(imageUrls[monitorId])
        }
        const blob = new Blob([event.data], { type: 'image/jpeg' })
        setImageUrls(prev => ({
          ...prev,
          [monitorId]: URL.createObjectURL(blob)
        }))
      }
      
      setCleanupFns(prev => ({
        ...prev,
        [monitorId]: () => ws.close()
      }))
      
      toast.success('监控已启动')
      fetchMonitors()
    } catch (error) {
      toast.error('启动监控任务失败')
    }
  }

  // 停止监控
  const stopMonitor = async (monitorId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/monitor-tasks/${monitorId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        throw new Error('停止监控任务失败')
      }

      // 明确停止时才关闭WebSocket连接
      wsManager.stopMonitoring(monitorId)
      
      if (imageUrls[monitorId]) {
        URL.revokeObjectURL(imageUrls[monitorId])
        setImageUrls(prev => {
          const newUrls = { ...prev }
          delete newUrls[monitorId]
          return newUrls
        })
      }

      toast.success('监控已停止')
      fetchMonitors()
    } catch (error) {
      toast.error('停止监控任务失败')
    }
  }

  const handleDeleteMonitor = async (monitorId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/monitor-tasks/${monitorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        throw new Error('删除监控任务失败')
      }
      toast.success('监控任务已删除')
      fetchMonitors()
    } catch (error) {
      toast.error('删除监控任务失败')
    }
  }

  // 创建并启动监控任务
  const createAndStartMonitor = async (taskId: number) => {
    try {
      // 1. 创建监控任务
      const createResponse = await fetch(`${config.apiUrl}/monitor-tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_id: taskId })
      })
      
      if (!createResponse.ok) {
        throw new Error('创建监控任务失败')
      }
      
      const monitorTask = await createResponse.json()

      // 2. 启动监控任务
      await startMonitor(monitorTask.id)
      
    } catch (error) {
      toast.error('创建或启动监控任务失败')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">视频监控</h1>
        <Button onClick={() => {
          // 这里可以添加一个对话框让用户选择要监控的任务
          // 或者跳转到任务列表页面
        }}>添加监控</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {monitors.map((monitor) => (
          <Card key={monitor.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">{monitor.task_name}</h3>
                <p className="text-sm text-muted-foreground">监控 #{monitor.id}</p>
              </div>
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                monitor.status === 'running' 
                  ? "bg-green-100 text-green-700" 
                  : "bg-gray-100 text-gray-700"
              )}>
                {monitor.status === 'running' ? '运行中' : '已停止'}
              </div>
            </div>

            <div className="aspect-video bg-black mt-2">
              {imageUrls[monitor.id] && (
                <img
                  src={imageUrls[monitor.id]}
                  className="w-full h-full object-contain"
                  alt={`Monitor ${monitor.id}`}
                />
              )}
            </div>

            <div className="mt-4 space-x-2">
              {monitor.status === 'stopped' ? (
                <Button 
                  size="sm" 
                  onClick={() => startMonitor(monitor.id)}
                >
                  启动监控
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => stopMonitor(monitor.id)}
                >
                  停止监控
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
} 