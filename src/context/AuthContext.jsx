import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out
  const [error, setError] = useState(null)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  async function signIn(email, password) {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError(translateAuthError(e.code))
      throw e
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

function translateAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou mot de passe incorrect.'
    case 'auth/too-many-requests':
      return 'Trop de tentatives, réessaie dans un instant.'
    default:
      return "Connexion impossible, réessaie."
  }
}

export function useAuth() {
  return useContext(AuthContext)
}
