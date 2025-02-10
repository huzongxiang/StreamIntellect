'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { config } from '@/config'
import { isNumeric } from '@/lib/utils'

export default function RegisterForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isNumeric(username)) {
      toast.error('用户名不能是纯数字')
      return
    }

    try {
      const response = await fetch(`${config.apiUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        toast.error('注册失败')
        return
      }

      toast.success('注册成功')
    } catch (error) {
      toast.error('注册失败，请稍后重试')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        required
      />
      <Button type="submit">注册</Button>
    </form>
  )
} 