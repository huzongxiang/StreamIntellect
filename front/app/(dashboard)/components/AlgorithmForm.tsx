'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { validateName } from '@/lib/utils'
import { config } from '@/config'

interface AlgorithmFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function AlgorithmForm({ onClose, onSuccess }: AlgorithmFormProps) {
  const [name, setName] = useState('')
  const [weightFile, setWeightFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !weightFile) {
      toast.error('请填写完整信息')
      return
    }
    
    const { isValid, error } = validateName(name)
    if (!isValid) {
      toast.error(error)
      return
    }

    const formData = new FormData()
    formData.append('algorithm', JSON.stringify({ name: name.trim() }))
    formData.append('weight_file', weightFile)

    try {
      const response = await fetch(`${config.apiUrl}/algorithms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      })

      const data = await response.json()
      console.log('Response:', response.status, data)
      
      if (!response.ok) {
        toast.error(data.detail)
        return
      }

      toast.success('创建算法成功')
      onSuccess()
    } catch (error) {
      toast.error('网络错误，请稍后重试')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <h2 className="text-lg font-bold mb-4">添加算法</h2>
            <div>
              <Input
                placeholder="算法名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="file"
                accept=".pt,.pth,.weights"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setWeightFile(file)
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button 
                type="submit"
                disabled={!name || !weightFile}
              >
                确定
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

