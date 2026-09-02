import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useDoc(path) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, path), (snap) => {
      setData(snap.exists() ? snap.data() : null)
      setLoading(false)
    })
    return unsub
  }, [path])

  return { data, loading }
}
