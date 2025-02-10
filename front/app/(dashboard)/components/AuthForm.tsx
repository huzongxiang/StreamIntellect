'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { config } from '@/config'

interface AuthFormProps {
  onSuccess: () => void
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError("")

    const isLogin = event.currentTarget.getAttribute("data-action") === "login"

    try {
      if (isLogin) {
        console.log("Sending login request...", { username, password })
        const response = await fetch(`${config.apiUrl}/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username,
            password,
            grant_type: "password"
          }).toString()
        })

        const data = await response.json()
        console.log("Login response:", data)

        if (!response.ok) {
          throw new Error(data.detail || "登录失败")
        }

        localStorage.setItem("token", data.access_token)
        onSuccess()
      } else {
        console.log("Sending register request...", { username, password })
        const registerResponse = await fetch(`${config.apiUrl}/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          })
        })

        const registerData = await registerResponse.json()
        console.log("Register response:", registerData)

        if (!registerResponse.ok) {
          throw new Error(registerData.detail || "注册失败")
        }

        console.log("Auto login after registration...")
        const loginResponse = await fetch(`${config.apiUrl}/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username,
            password,
            grant_type: "password"
          }).toString()
        })

        const loginData = await loginResponse.json()
        console.log("Auto login response:", loginData)

        if (!loginResponse.ok) {
          throw new Error(loginData.detail || "自动登录失败")
        }

        localStorage.setItem("token", loginData.access_token)
        onSuccess()
      }
    } catch (err) {
      console.error("Error:", err)
      setError(err instanceof Error ? err.message : "操作失败")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-[350px] mx-auto">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">用户认证</h2>
        <p className="text-sm text-gray-500 mb-6">注册新账户或登录已有账户</p>
      </div>
      <div className="p-6 pt-0">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleSubmit} data-action="login">
              <div className="space-y-4">
                <Input
                  name="username"
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <Input
                  name="password"
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button 
                  className="w-full" 
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? "登录中..." : "登录"}
                </Button>
                {error && (
                  <div className="text-sm text-red-500 mt-2">
                    {error}
                  </div>
                )}
              </div>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleSubmit} data-action="register">
              <div className="space-y-4">
                <Input
                  name="username"
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <Input
                  name="password"
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button 
                  className="w-full" 
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? "注册中..." : "注册"}
                </Button>
                {error && (
                  <div className="text-sm text-red-500 mt-2">
                    {error}
                  </div>
                )}
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  )
}

