// components/DeleteButton.tsx
// Client Component für Löschen-Button mit Bestätigung

'use client'

import SimpleIcon from './SimpleIcon'

interface DeleteButtonProps {
  investitionId: string
  bezeichnung: string
  deleteAction: (formData: FormData) => Promise<void>
}

export default function DeleteButton({ investitionId, bezeichnung, deleteAction }: DeleteButtonProps) {
  const handleDelete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!confirm(`"${bezeichnung}" wirklich löschen?`)) {
      return
    }

    const formData = new FormData()
    formData.append('id', investitionId)
    
    await deleteAction(formData)
  }

  return (
    <form onSubmit={handleDelete}>
      <button
        type="submit"
        className="text-red-600 hover:text-red-900"
        title="Löschen"
      >
        <SimpleIcon type="trash" className="w-4 h-4" />
      </button>
    </form>
  )
}
