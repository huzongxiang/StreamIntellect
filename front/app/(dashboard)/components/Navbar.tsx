'use client'

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogOut, Brain, Camera, CircuitBoard } from "lucide-react"

export default function Navbar() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <div className="h-16 border-b bg-white fixed top-0 right-0 left-0 z-30 px-4">
      <div className="h-full flex items-center justify-between">
        {/* Logo 部分 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center text-primary">
            <Brain className="h-8 w-8" />
            <Camera className="h-8 w-8 -ml-2" />
          </div>
          <span className="font-bold text-xl text-primary">AI 视频分析平台</span>
        </div>

        {/* 右侧按钮 */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>退出登录</span>
        </Button>
      </div>
    </div>
  )
} 