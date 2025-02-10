'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { validateName } from '@/lib/utils'
import { config } from '@/config'

interface TestTaskFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function TestTaskForm({ onClose, onSuccess }: TestTaskFormProps) {
  const [algorithms, setAlgorithms] = useState([])
  const [algorithmId, setAlgorithmId] = useState('')
  const [taskName, setTaskName] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)

  useEffect(() => {
    fetchAlgorithms()
  }, [])

  const fetchAlgorithms = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/algorithms`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        toast.error('获取算法列表失败')
        return
      }
      const data = await response.json()
      setAlgorithms(data)
    } catch (error) {
      toast.error('获取算法列表失败，请稍后重试')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!taskName || !videoFile || !algorithmId) {
      toast.error('请填写完整信息')
      return
    }

    const { isValid, error } = validateName(taskName)
    if (!isValid) {
      toast.error(error)
      return
    }

    const formData = new FormData()
    formData.append('task_data', JSON.stringify({
      name: taskName.trim(),
      algorithm_id: parseInt(algorithmId),
      status: 'stopped'
    }))
    formData.append('video_file', videoFile)

    try {
      const response = await fetch(`${config.apiUrl}/test-tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      })

      const data = await response.json()
      console.log('Response:', {
        status: response.status,
        data: data,
        formData: Object.fromEntries(formData.entries())
      })
      
      if (!response.ok) {
        toast.error(data.detail || '创建测试任务失败')
        return
      }

      toast.success('创建测试任务成功')
      onSuccess()
    } catch (error) {
      toast.error('创建测试任务失败，请稍后重试')
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建测试任务</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="任务名称"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />
          </div>
          <div>
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setVideoFile(file)
                }
              }}
            />
          </div>
          <div>
            <Select value={algorithmId} onValueChange={setAlgorithmId}>
              <SelectTrigger>
                <SelectValue placeholder="选择算法" />
              </SelectTrigger>
              <SelectContent>
                {algorithms.map((algorithm: any) => (
                  <SelectItem key={algorithm.id} value={algorithm.id.toString()}>
                    {algorithm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button 
              type="submit"
              disabled={!taskName || !videoFile || !algorithmId}
            >
              确定
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 