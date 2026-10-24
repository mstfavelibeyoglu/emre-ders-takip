import { createContext, useContext } from 'react'

// 'owner' (yönetici) · 'editor' (Emre) · 'viewer' (yalnızca görüntüler) · 'local' (Firebase yok)
export const RoleContext = createContext('local')
export const useRole = () => useContext(RoleContext)
export const canEditRole = role => role === 'owner' || role === 'editor' || role === 'local'
