import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { config } from '@/config'

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  // ...
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(`${config.apiUrl}/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      // ...
    }
  }
} 