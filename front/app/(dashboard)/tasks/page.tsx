'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import TaskForm from '../components/TaskForm'
import { toast } from "sonner"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { config } from '@/config'
import { Webcam, Binary, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface Task {
  id: number
  name: string
  status: string
  device: {
    id: number
    name: string
  }
  algorithm: {
    id: number
    name: string
  }
}

interface ResultViewerProps {
  taskId: number
  taskStatus: string
  onClose?: () => void
}

function ResultViewer({ taskId, taskStatus, onClose }: ResultViewerProps) {
  const [log, setLog] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLog = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${config.apiUrl}/tasks/${taskId}/log`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setLog(data.log)
        }
      } catch (error) {
        console.error('Error fetching log:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [taskId])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">处理日志</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
          >
            关闭
          </Button>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm h-[400px] overflow-auto">
            {log || '暂无日志'}
          </pre>
        )}
      </div>
      <div 
        className="absolute inset-0 -z-10" 
        onClick={onClose}
      />
    </div>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<number | null>(null)

  useEffect(() => {
    // 定期刷新任务列表
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/tasks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        toast.error('获取任务列表失败')
        return
      }
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      toast.error('获取任务列表失败，请稍后重试')
    }
  }

  const handleStartTask = async (taskId: number) => {
    try {
      // 启动任务
      const response = await fetch(`${config.apiUrl}/tasks/${taskId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.detail || '启动任务失败')
        return
      }

      toast.success('任务已启动，监控已创建')
      fetchTasks()
    } catch (error) {
      toast.error('启动任务失败，请稍后重试')
    }
  }

  const handleStopTask = async (taskId: number) => {
    try {
      // 停止任务
      const response = await fetch(`${config.apiUrl}/tasks/${taskId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.detail || '停止任务失败')
        return
      }

      toast.success('任务已停止，监控已删除')
      fetchTasks()
    } catch (error) {
      toast.error('停止任务失败，请稍后重试')
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    try {
      // 检查关联的监控任务状态
      const monitorsResponse = await fetch(`${config.apiUrl}/monitor-tasks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (monitorsResponse.ok) {
        const monitors = await monitorsResponse.json()
        const relatedMonitor = monitors.find(m => m.task_id === taskId)
        
        if (relatedMonitor) {
          if (relatedMonitor.status === 'running') {
            toast.error('请先停止关联的监控任务')
            return
          }
          // 删除已停止的监控任务
          await fetch(`${config.apiUrl}/monitor-tasks/${relatedMonitor.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          })
        }
      }

      // 删除任务
      const response = await fetch(`${config.apiUrl}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.detail || '删除任务失败')
        return
      }

      toast.success('任务已删除')
      fetchTasks()
    } catch (error) {
      toast.error('删除任务失败，请稍后重试')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">任务管理</h1>
        <Button onClick={() => setShowForm(true)}>创建任务</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">{task.name}</h3>
                <p className="text-sm text-muted-foreground">任务 #{task.id}</p>
              </div>
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                task.status === 'running' 
                  ? "bg-green-100 text-green-700" 
                  : "bg-gray-100 text-gray-700"
              )}>
                {task.status === 'running' ? '运行中' : '已停止'}
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Webcam className="h-4 w-4" />
                设备: {task.device.name}
              </p>
              <p className="flex items-center gap-2">
                <Binary className="h-4 w-4" />
                算法: {task.algorithm.name}
              </p>
            </div>

            <div className="mt-4 space-x-2">
              {task.status === 'stopped' ? (
                <>
                  <Button size="sm" onClick={() => handleStartTask(task.id)}>
                    启动
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    删除
                  </Button>
                </>
              ) : (
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => handleStopTask(task.id)}
                >
                  停止
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedTask(task.id)}
              >
                查看日志
              </Button>
            </div>

            {selectedTask === task.id && (
              <ResultViewer 
                taskId={task.id} 
                taskStatus={task.status} 
                onClose={() => setSelectedTask(null)} 
              />
            )}
          </Card>
        ))}
      </div>

      {showForm && (
        <TaskForm 
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchTasks()
          }}
        />
      )}
    </div>
  )
} 