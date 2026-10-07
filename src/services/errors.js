export class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message)
    this.name = 'ValidationError'
    this.fields = fields
  }
}

// Turns a Postgres / PostgREST / Storage error into a message a person can act on.
// Our own trigger messages (raised with a clear sentence) pass straight through.
export function toAppError(err) {
  if (!err || err.name === 'ValidationError') return err
  const code = String(err.code ?? err.statusCode ?? err.status ?? '')
  const msg = String(err.message ?? err.error ?? err)
  let text
  if (code === '42501' || /row-level security|permission denied|not authorized|Unauthorized/i.test(msg)) {
    text = /Only an admin/.test(msg) ? msg : "You don't have permission to do this. Ask an admin if you need it changed."
  } else if (code === '23503') {
    text = /still referenced|update or delete on table/i.test(msg)
      ? "This record is used by other records, so it can't be deleted."
      : 'A linked record no longer exists. Refresh and try again.'
  } else if (code === '23505') {
    text = 'That already exists — the name, number or code must be unique.'
  } else if (code === '23514') {
    text = /violates check constraint/.test(msg) ? 'That value is not allowed for this record.' : msg
  } else if (code === '23502') {
    text = 'A required value is missing.'
  } else if (code === '413' || /exceeded the maximum allowed size|Payload too large/i.test(msg)) {
    text = 'Files must be 5 MB or smaller.'
  } else if (/Failed to fetch|NetworkError|network|fetch failed/i.test(msg)) {
    return Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { cause: err })
  } else {
    return Object.assign(new Error(msg), { cause: err })
  }
  return Object.assign(new ValidationError(text), { cause: err })
}
