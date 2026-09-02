import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

/** Full-screen camera modal that scans a barcode and reports it back. */
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls
    let cancelled = false

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, err, ctrls) => {
          controls = ctrls
          if (cancelled) return
          if (result) {
            cancelled = true
            ctrls.stop()
            onDetected(result.getText())
          }
        },
      )
      .catch((e) => setError(e?.message || "Impossible d'accéder à la caméra"))

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-medium">Scanner un produit</span>
        <button onClick={onClose} className="text-white/80 text-2xl leading-none px-2">
          ×
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-40 border-4 border-emerald-400/80 rounded-2xl" />
        </div>
      </div>
      {error && (
        <p className="text-red-400 text-sm text-center px-4 py-3">{error}</p>
      )}
      <p className="text-white/60 text-sm text-center px-4 pb-6">
        Vise le code-barres du produit
      </p>
    </div>
  )
}
