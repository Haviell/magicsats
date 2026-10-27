export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;
  
  // Comprimento mínimo
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  
  // Complexidade
  if (/[A-Z]/.test(password)) score++; // Maiúsculas
  if (/[a-z]/.test(password)) score++; // Minúsculas
  if (/[0-9]/.test(password)) score++; // Números
  if (/[^A-Za-z0-9]/.test(password)) score++; // Caracteres especiais
  
  if (score < 3) return 'weak';
  if (score < 5) return 'medium';
  return 'strong';
} 