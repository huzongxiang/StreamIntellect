export function validateName(name: string) {
  if (name.length < 2) {
    return {
      isValid: false,
      error: '名称长度不能小于2个字符'
    }
  }
  
  if (name.length > 20) {
    return {
      isValid: false,
      error: '名称长度不能超过20个字符'
    }
  }
  
  // 只允许中文、英文、数字和下划线
  const regex = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/
  if (!regex.test(name)) {
    return {
      isValid: false,
      error: '名称只能包含中文、英文、数字和下划线'
    }
  }
  
  return {
    isValid: true,
    error: null
  }
} 