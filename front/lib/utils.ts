import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function validateName(name: string): { isValid: boolean; error?: string } {
  if (!name) {
    return { isValid: false, error: '名称不能为空' }
  }

  if (!/^[a-zA-Z]/.test(name)) {
    return { isValid: false, error: '名称必须以字母开头' }
  }

  if (/^\d+$/.test(name)) {
    return { isValid: false, error: '名称不能为纯数字' }
  }

  return { isValid: true }
}
