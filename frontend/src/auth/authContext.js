import { createContext, useContext } from 'react'
export const AuthContext = createContext(null)
export function useStudyAuth() { return useContext(AuthContext) }
