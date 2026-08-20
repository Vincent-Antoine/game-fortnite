'use client'

import { compressPhoto } from '@/lib/compress-photo'

export function PhotoPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-hud text-xs tracking-[0.2em] text-mute">PHOTO (OPTIONNEL)</span>
      <div className="flex items-center gap-3">
        <label className="relative cursor-pointer">
          {value ? (
            <img src={value} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-horizon" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-dusk text-2xl text-mute ring-1 ring-white/15">
              +
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) {
                return
              }
              void compressPhoto(file).then(onChange)
            }}
          />
        </label>
        <div className="text-sm text-mute">
          <p>Comme l’avatar, pour cette session seulement.</p>
          {value ? (
            <button type="button" className="mt-1 text-kill underline" onClick={() => onChange(null)}>
              Retirer
            </button>
          ) : (
            <p>Tape le cercle pour choisir une photo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
