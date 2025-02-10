import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from "sonner"

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI 视频分析平台',
  description: '基于 YOLOv8 的视频分析平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}

