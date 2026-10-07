import { useState } from 'react'
import { useToast, describeError } from '../components/ui/Toast'

// Small form state helper: values, per-field errors from the service layer's
// ValidationError, a saving flag, and toast feedback.
export function useForm(initial) {
  const toast = useToast()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }
  const bind = (key) => ({ value: values[key] ?? '', onChange: (e) => set(key, e.target.value), invalid: !!errors[key] })

  // save: async () => any. Returns true on success.
  async function submit(event, save, { success, onDone } = {}) {
    event?.preventDefault()
    if (saving) return false
    setSaving(true)
    setErrors({})
    try {
      const result = await save(values)
      if (success) toast.success(typeof success === 'function' ? success(result) : success)
      onDone?.(result)
      return true
    } catch (err) {
      if (err?.name === 'ValidationError') {
        setErrors(err.fields ?? {})
        if (!Object.keys(err.fields ?? {}).length) toast.error(err.message)
      } else {
        console.error(err)
        toast.error(describeError(err))
      }
      return false
    } finally {
      setSaving(false)
    }
  }

  return { values, errors, saving, set, bind, submit, setValues }
}
