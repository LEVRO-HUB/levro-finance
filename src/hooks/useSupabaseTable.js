import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSupabaseTable(table, { select = '*', orderBy = 'created_at', ascending = false, filter } = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from(table).select(select).order(orderBy, { ascending })
    if (filter) query = filter(query)
    const { data: rows, error: err } = await query
    if (err) {
      setError(err)
    } else {
      setError(null)
      setData(rows ?? [])
    }
    setLoading(false)
  }, [table, select, orderBy, ascending, filter])

  useEffect(() => {
    refetch()
  }, [refetch])

  const insert = useCallback(
    async (values) => {
      const { data: inserted, error: err } = await supabase.from(table).insert(values).select().single()
      if (err) throw err
      await refetch()
      return inserted
    },
    [table, refetch],
  )

  const update = useCallback(
    async (id, values) => {
      const { error: err } = await supabase.from(table).update(values).eq('id', id)
      if (err) throw err
      await refetch()
    },
    [table, refetch],
  )

  const remove = useCallback(
    async (id) => {
      const { error: err } = await supabase.from(table).delete().eq('id', id)
      if (err) throw err
      await refetch()
    },
    [table, refetch],
  )

  return { data, loading, error, refetch, insert, update, remove }
}
