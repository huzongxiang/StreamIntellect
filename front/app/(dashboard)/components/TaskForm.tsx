'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { validateName } from '@/lib/utils'
import { Input } from "@/components/ui/input"
import { config } from '@/config'

interface TaskFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function TaskForm({ onClose, onSuccess }: TaskFormProps) {
  const [devices, setDevices] = useState([])
  const [algorithms, setAlgorithms] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [algorithmId, setAlgorithmId] = useState('')
  const [taskName, setTaskName] = useState('')

  useEffect(() => {
    fetchDevices()
    fetchAlgorithms()
  }, [])

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/devices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        toast.error('获取设备列表失败')
        return
      }
      const data = await response.json()
      setDevices(data)
    } catch (error) {
      toast.error('获取设备列表失败，请稍后重试')
    }
  }

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
    if (!taskName || !deviceId || !algorithmId) {
      toast.error('请填写完整信息')
      return
    }

    const { isValid, error } = validateName(taskName)
    if (!isValid) {
      toast.error(error)
      return
    }

    try {
      const response = await fetch(`${config.apiUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: taskName.trim(),
          device_id: parseInt(deviceId),
          algorithm_id: parseInt(algorithmId),
          status: 'stopped'
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.detail || '创建任务失败')
        return
      }

      toast.success('创建任务成功')
      onSuccess()
    } catch (error) {
      toast.error('创建任务失败，请稍后重试')
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建任务</DialogTitle>
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
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="选择设备" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device: any) => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabled={!deviceId || !algorithmId}
            >
              确定
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

