'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { config } from '@/config'
import { validateName } from '@/lib/utils'

interface DeviceFormProps {
  onClose: () => void
  onSuccess: () => void
  device?: {
    id: number
    name: string
    rtsp_url: string
  }
}

export default function DeviceForm({ onClose, onSuccess, device }: DeviceFormProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(device?.name || "")
  const [rtspUrl, setRtspUrl] = useState(device?.rtsp_url || "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { isValid, error } = validateName(name)
    if (!isValid) {
      toast.error(error)
      return
    }
    
    try {
      const response = await fetch(
        device ? `${config.apiUrl}/devices/${device.id}` : `${config.apiUrl}/devices`,
        {
          method: device ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ name, rtsp_url: rtspUrl })
        }
      )
      
      if (!response.ok) {
        const data = await response.json()
        toast.error(data.detail || (device ? '更新设备失败' : '创建设备失败'))
        return
      }
      
      toast.success(device ? '设备更新成功' : '设备创建成功')
      onSuccess()
    } catch (error) {
      toast.error(device ? '更新设备失败，请稍后重试' : '创建设备失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{device ? '编辑设备' : '添加设备'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">设备名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入设备名称"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">RTSP地址</label>
            <Input
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="请输入RTSP地址"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="submit"
              disabled={loading}
            >
              {device ? '更新' : '添加'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

