// rows: array of plain objects; columns: [{ label, value: (row) => any }]
export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(','))].join('\r\n')
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function downloadCSV(fileName, columns, rows) {
  // BOM so Excel opens ₹ and other UTF-8 text correctly
  downloadBlob(new Blob(['﻿', toCSV(columns, rows)], { type: 'text/csv;charset=utf-8' }), fileName)
}
