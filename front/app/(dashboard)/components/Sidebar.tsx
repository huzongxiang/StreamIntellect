'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"
import { useState } from 'react'
import { 
  Webcam, 
  Binary, 
  ListTodo, 
  Monitor, 
  TestTube2,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface SidebarProps {
  isSuperUser: boolean
}

export default function Sidebar({ isSuperUser }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const links = [
    {
      href: '/monitor',
      label: '视频监控',
      icon: Monitor
    },
    {
      href: '/devices',
      label: '设备管理',
      icon: Webcam
    },
    {
      href: '/algorithms',
      label: '算法管理',
      icon: Binary
    },
    {
      href: '/tasks',
      label: '任务管理',
      icon: ListTodo
    },
    {
      href: '/test',
      label: '算法测试',
      icon: TestTube2
    },
    ...(isSuperUser ? [
      {
        href: '/users',
        label: '用户管理',
        icon: Users
      }
    ] : [])
  ]

  return (
    <div className={cn(
      "fixed left-0 top-16 bottom-0",
      "min-h-[calc(100vh-4rem)] bg-gray-100 p-4",
      "transition-all duration-300 ease-in-out",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn(
        "flex items-center mb-8",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && <div className="text-xl font-bold">AI 视频分析</div>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav>
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center px-4 py-3 my-1 rounded-lg transition-colors",
              isCollapsed ? "justify-center" : "justify-start",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
            title={isCollapsed ? label : undefined}
          >
            <Icon className={cn(
              "h-5 w-5",
              isCollapsed ? "mr-0" : "mr-3"
            )} />
            {!isCollapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </div>
  )
}