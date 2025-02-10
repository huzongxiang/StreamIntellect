'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import TestTaskForm from '../components/TestTaskForm'
import { toast } from "sonner"
import { config } from '@/config'

interface TestTask {
  id: number
  name: string
  video_path: string
  algorithm_id: number
  status: string
}

interface ResultViewerProps {
  taskName: string
  taskStatus: string
  mode: 'log' | 'video'
  onClose?: () => void
}

function ResultViewer({ taskName, taskStatus, mode, onClose }: ResultViewerProps) {
  const [frames, setFrames] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [log, setLog] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 组件卸载时清除所有相关的 toast
  useEffect(() => {
    return () => {
      // 清除所有 toast
      toast.dismiss()
    }
  }, [])

  useEffect(() => {
    const fetchFrames = async () => {
      setLoading(true)
      try {
        if (mode === 'video') {
          const checkResponse = await fetch(`${config.apiUrl}/results/${taskName}/check-video`)
          const checkData = await checkResponse.json()
          console.log('Video file check:', checkData)
          if (!checkData.exists) {
            if (mode === 'video') {
              toast.error('视频文件不存在')
            }
            return
          }
        }
        
        const response = await fetch(`${config.apiUrl}/results/${taskName}/frames`)
        if (response.ok) {
          const data = await response.json()
          setFrames(data.frames)
        }
        
        // 尝试获取错误信息和处理日志
        try {
          const [errorResponse, logResponse] = await Promise.all([
            fetch(`${config.apiUrl}/results/${taskName}/error.txt`),
            fetch(`${config.apiUrl}/results/${taskName}/process.log`)
          ])
          
          if (errorResponse.ok) {
            const errorText = await errorResponse.text()
            setErrorMessage(errorText)
          }
          
          if (logResponse.ok) {
            const logText = await logResponse.text()
            setLog(logText)
          }
        } catch (error) {
          // 忽略错误
        }
      } catch (error) {
        console.error('Error fetching results:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchFrames()
  }, [taskName, mode])

  if (mode === 'video') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-4 w-full max-w-4xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">处理结果</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              关闭
            </Button>
          </div>
          {taskStatus === 'completed' ? (
            <div className="bg-black rounded-lg p-2">
              <video
                ref={videoRef}
                src={`${config.apiUrl}/results/${taskName}/output.mp4`}
                controls
                className="w-full rounded"
                style={{ aspectRatio: '16/9' }}
                poster={frames.length > 0 ? `${config.apiUrl}/results/${taskName}/${frames[0]}` : undefined}
                autoPlay
                playsInline
                preload="auto"
                crossOrigin="anonymous"
                onError={(e) => {
                  console.error('Video error:', e.currentTarget.error);
                  if (mode === 'video') {
                    toast.error(`视频加载失败: ${e.currentTarget.error?.message || '未知错误'}`);
                  }
                }}
                onLoadStart={() => {
                  console.log('Video load started');
                  if (mode === 'video') {
                    const loadingToast = toast.loading('正在加载视频...');
                    videoRef.current?.setAttribute('data-loading-toast', loadingToast);
                  }
                }}
                onLoadedData={() => {
                  console.log('Video loaded');
                  const loadingToast = videoRef.current?.getAttribute('data-loading-toast');
                  if (loadingToast) {
                    toast.dismiss(loadingToast);
                    if (mode === 'video') {
                      toast.success('视频加载完成');
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {taskStatus === 'running' ? '正在处理视频...' : '暂无处理结果'}
            </div>
          )}
        </div>
        <div 
          className="absolute inset-0 -z-10" 
          onClick={onClose}
        />
      </div>
    )
  }

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
          <>
            {errorMessage && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
                <h4 className="font-bold mb-2">错误信息：</h4>
                <pre className="whitespace-pre-wrap">{errorMessage}</pre>
              </div>
            )}
            <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm h-[400px] overflow-auto">
              {log || '暂无日志'}
            </pre>
          </>
        )}
      </div>
      <div 
        className="absolute inset-0 -z-10" 
        onClick={onClose}
      />
    </div>
  )
}

export default function TestPage() {
  const [tasks, setTasks] = useState<TestTask[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [selectedVideoTask, setSelectedVideoTask] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()
    // 定期刷新任务列表
    const interval = setInterval(fetchTasks, 5000)  // 改为每5秒刷新一次
    return () => clearInterval(interval)
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/test-tasks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        toast.error('获取测试任务列表失败')
        return
      }
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      toast.error('获取测试任务列表失败，请稍后重试')
    }
  }

  const handleStartTask = async (taskId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/test-tasks/${taskId}/start`, {
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

      toast.success(data.message)
      fetchTasks()
    } catch (error) {
      toast.error('启动任务失败，请稍后重试')
    }
  }

  const handleStopTask = async (taskId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/test-tasks/${taskId}/stop`, {
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

      toast.success(data.message)
      fetchTasks()
    } catch (error) {
      toast.error('停止任务失败，请稍后重试')
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/test-tasks/${taskId}`, {
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

      toast.success(data.message)
      fetchTasks()
    } catch (error) {
      toast.error('删除任务失败，请稍后重试')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">算法测试</h1>
        <Button onClick={() => setShowForm(true)}>
          添加测试
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="p-4">
            <h3 className="font-bold">{task.name}</h3>
            <p className="text-sm text-muted-foreground">{task.video_path}</p>
            <div className="mt-4 space-x-2">
              {task.status === 'stopped' ? (
                <>
                  <Button 
                    size="sm"
                    onClick={() => handleStartTask(task.id)}
                  >
                    开始测试
                  </Button>
                  <Button 
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    删除
                  </Button>
                </>
              ) : task.status === 'running' ? (
                <Button 
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStopTask(task.id)}
                >
                  停止测试
                </Button>
              ) : task.status === 'completed' ? (
                <>
                  <Button 
                    size="sm"
                    variant="secondary"
                    disabled
                  >
                    测试完成
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
                <>
                  <Button 
                    size="sm"
                    variant="destructive"
                    disabled
                  >
                    测试失败
                  </Button>
                  <Button 
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    删除
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedTask(task.name)}
              >
                查看日志
              </Button>
              {task.status === 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedVideoTask(task.name)}
                >
                  播放视频
                </Button>
              )}
            </div>
            {selectedTask === task.name && (
              <ResultViewer 
                taskName={task.name} 
                taskStatus={task.status} 
                mode="log" 
                onClose={() => setSelectedTask(null)} 
              />
            )}
            {selectedVideoTask === task.name && (
              <ResultViewer 
                taskName={task.name} 
                taskStatus={task.status} 
                mode="video" 
                onClose={() => setSelectedVideoTask(null)} 
              />
            )}
          </Card>
        ))}
      </div>

      {showForm && (
        <TestTaskForm 
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