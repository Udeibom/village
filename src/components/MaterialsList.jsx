import React from 'react'
import { newMaterialRow } from '../lib/materialRows.js'

export default function MaterialsList({ materials, onChange }) {
  const updateRow = (id, field, value) => {
    onChange(
      materials.map((material) =>
        material.id === id ? { ...material, [field]: value } : material,
      ),
    )
  }

  const removeRow = (id) => {
    onChange(materials.filter((material) => material.id !== id))
  }

  const addRow = () => {
    onChange([...materials, newMaterialRow()])
  }

  return (
    <div className="materials">
      <div className="materials-header">
        <span className="field-label">Materials on hand</span>
        <button type="button" className="button-quiet" onClick={addRow}>
          Add material
        </button>
      </div>

      <p className="card-hint">
        Name and how many. Counting by eye is honest — write &ldquo;a bag&rdquo;
        if a bag is what you have.
      </p>

      {materials.length === 0 ? (
        <p className="empty-note">
          No materials yet. Add at least one before generating a lesson.
        </p>
      ) : (
        <ul className="material-list">
          {materials.map((material) => (
            <li key={material.id} className="material-row">
              <input
                type="text"
                className="material-name"
                aria-label="Material name"
                placeholder="bottle tops"
                value={material.name}
                onChange={(event) =>
                  updateRow(material.id, 'name', event.target.value)
                }
              />
              <input
                type="text"
                className="material-quantity"
                aria-label="Quantity"
                placeholder="40"
                value={material.quantity}
                onChange={(event) =>
                  updateRow(material.id, 'quantity', event.target.value)
                }
              />
              <button
                type="button"
                className="button-quiet button-remove"
                aria-label={`Remove ${material.name || 'material'}`}
                onClick={() => removeRow(material.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
