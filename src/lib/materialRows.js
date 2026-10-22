// Material rows need an id so React can keep track of them while the teacher
// types. The id is for the form only — it never leaves the browser.

let nextRowId = 1

export function newMaterialRow() {
  return { id: `material-${nextRowId++}`, name: '', quantity: '' }
}
