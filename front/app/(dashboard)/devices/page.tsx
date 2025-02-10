'use client'

import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import DeviceForm from '../components/DeviceForm'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { toast } from "sonner"
import { config } from '@/config'

interface Device {
  id: number
  name: string
  rtsp_url: string
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [showForm, setShowForm] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<number | null>(null)
  const [previewWs, setPreviewWs] = useState<WebSocket | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [previewError, setPreviewError] = useState<string | null>(null)

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

  useEffect(() => {
    fetchDevices()
  }, [])

  const handleDeleteDevice = async (deviceId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.detail || '删除设备失败')
        return
      }

      toast.success(data.message)
      fetchDevices()
    } catch (error) {
      toast.error('删除设备失败，请稍后重试')
    }
  }

  const cleanupPreview = () => {
    if (previewWs) {
      if (previewWs.readyState === WebSocket.OPEN) {
        previewWs.close()
      }
      setPreviewWs(null)
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    }
    setPreviewDevice(null)
    setPreviewError(null)
  }

  const startPreview = (deviceId: number) => {
    cleanupPreview()
    
    const ws = new WebSocket(`${config.wsUrl}/ws/device-preview/${deviceId}`)
    const token = localStorage.getItem('token')
    
    const connectionTimeout = setTimeout(() => {
      toast.error('预览连接超时')
      cleanupPreview()
    }, 5000)
    
    ws.onopen = () => {
      clearTimeout(connectionTimeout)
      ws.send(JSON.stringify({ token }))
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.error) {
          setPreviewError(data.error)
          toast.error(data.error)
          return
        }
      } catch {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }
        const blob = new Blob([event.data], { type: 'image/jpeg' })
        setPreviewUrl(URL.createObjectURL(blob))
        setPreviewError(null)
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      toast.error('预览连接失败，请检查设备状态')
      setPreviewError('连接失败，请检查设备是否在线')
      cleanupPreview()
    }
    
    ws.onclose = () => {
      if (!previewError) {
        setPreviewError('预览已断开连接')
      }
      cleanupPreview()
    }
    
    setPreviewWs(ws)
    setPreviewDevice(deviceId)
  }

  const stopPreview = () => {
    cleanupPreview()
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">设备管理</h1>
        <Button onClick={() => setShowForm(true)}>添加设备</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => (
          <Card key={device.id} className="p-4">
            <h3 className="font-bold">{device.name}</h3>
            <p className="text-sm text-gray-500">{device.rtsp_url}</p>
            <div className="mt-4 space-x-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDeleteDevice(device.id)}
              >
                删除
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startPreview(device.id)}
              >
                预览
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {showForm && (
        <DeviceForm 
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchDevices()
          }}
        />
      )}

      {previewDevice && (
        <Dialog 
          open 
          onOpenChange={(open) => {
            if (!open) {
              cleanupPreview()
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <div className="aspect-video bg-black relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  className="w-full h-full object-contain"
                  alt="Device Preview"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {previewError ? (
                    <div className="text-white text-center">
                      <p className="text-red-500 mb-2">❌</p>
                      <p>{previewError}</p>
                    </div>
                  ) : (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 