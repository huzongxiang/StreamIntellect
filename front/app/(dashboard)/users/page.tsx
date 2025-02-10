'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { config } from '@/config'
import { cn } from "@/lib/utils"

interface User {
  id: number
  username: string
  status: string
  created_at: string
  is_superuser: boolean
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isSuperUser, setIsSuperUser] = useState(false)

  useEffect(() => {
    checkSuperUser()
    fetchUsers()
  }, [])

  const checkSuperUser = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setIsSuperUser(data.is_superuser)
      }
    } catch (error) {
      console.error('Error checking super user:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (!response.ok) {
        toast.error('获取用户列表失败')
        return
      }
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      toast.error('获取用户列表失败')
    }
  }

  const handleUpdateStatus = async (userId: number, status: string) => {
    try {
      const response = await fetch(`${config.apiUrl}/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.detail || '更新状态失败')
        return
      }

      toast.success('更新状态成功')
      fetchUsers()
    } catch (error) {
      toast.error('更新状态失败')
    }
  }

  if (!isSuperUser) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          您没有权限访问此页面
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <Card key={user.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg">{user.username}</h3>
                <p className="text-sm text-muted-foreground">
                  注册时间: {new Date(user.created_at).toLocaleString()}
                </p>
              </div>
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                user.status === 'approved' 
                  ? "bg-green-100 text-green-700"
                  : user.status === 'rejected'
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              )}>
                {user.status === 'approved' 
                  ? '已通过' 
                  : user.status === 'rejected'
                  ? '已拒绝'
                  : '待审核'}
              </div>
            </div>

            {!user.is_superuser && (
              <div className="mt-4 space-x-2">
                {user.status !== 'approved' && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(user.id, 'approved')}
                  >
                    通过
                  </Button>
                )}
                {user.status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleUpdateStatus(user.id, 'rejected')}
                  >
                    拒绝
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
} 