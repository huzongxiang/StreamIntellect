'use client'

import { useRouter } from 'next/navigation'
import { AuthForm } from '@/app/(dashboard)/components/AuthForm'

export default function LoginPage() {
  const router = useRouter()

  const onSuccess = () => {
    router.push('/devices')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">AI 视频分析平台</h1>
          <p className="text-gray-600">请登录以继续</p>
        </div>
        <AuthForm onSuccess={onSuccess} />
      </div>
    </div>
  )
}

