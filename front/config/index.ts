export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.137.243:8000"

export const config = {
  apiUrl: API_URL,
  wsUrl: API_URL.replace('http', 'ws'),
  fetchOptions: {
    timeout: 1000,  // 10 秒超时
    retries: 3,      // 重试3次
  }
} 