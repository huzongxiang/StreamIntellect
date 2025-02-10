'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { config } from '@/config'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isSuperUser, setIsSuperUser] = useState(false)

  useEffect(() => {
    checkSuperUser()
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex pt-16">
        <Sidebar isSuperUser={isSuperUser} />
        <main className="flex-1 ml-20 lg:ml-64 p-6 transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  )
} 