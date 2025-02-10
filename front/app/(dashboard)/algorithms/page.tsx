'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import AlgorithmForm from '../components/AlgorithmForm'
import { toast } from "sonner"
import { config } from '@/config'

export default function AlgorithmsPage() {
  const [algorithms, setAlgorithms] = useState([])
  const [showForm, setShowForm] = useState(false)

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

  const handleDeleteAlgorithm = async (algorithmId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/algorithms/${algorithmId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.detail || '删除算法失败')
        return
      }

      toast.success(data.message)
      fetchAlgorithms()
    } catch (error) {
      toast.error('删除算法失败，请稍后重试')
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">算法管理</h1>
        <Button onClick={() => setShowForm(true)}>添加算法</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {algorithms.map((algorithm: any) => (
          <Card key={algorithm.id} className="p-4">
            <h3 className="font-bold">{algorithm.name}</h3>
            <p className="text-sm text-muted-foreground">{algorithm.weight_path}</p>
            <div className="mt-4 space-x-2">
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => handleDeleteAlgorithm(algorithm.id)}
              >
                删除
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {showForm && (
        <AlgorithmForm 
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchAlgorithms()
          }}
        />
      )}
    </div>
  )
} 