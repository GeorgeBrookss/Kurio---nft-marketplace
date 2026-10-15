import { useCallback, useRef, useState } from 'react'
import type { ZodType, ZodTypeDef } from 'zod'
import { ApiError } from '@/api/http'

type Errors = Record<string, string | undefined>

export function useZodForm<T extends Record<string, unknown>, Out = T>(schema: ZodType<Out, ZodTypeDef, unknown>, initial: T, idPrefix: string) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const touched = useRef(new Set<string>())

  const validate = useCallback((v: T) => {
    const r = schema.safeParse(v)
    if (r.success) return { ok: true as const, data: r.data, errors: {} as Errors }
    const errs: Errors = {}
    for (const i of r.error.issues) { const k = i.path.join('.'); if (!errs[k]) errs[k] = i.message }
    return { ok: false as const, errors: errs }
  }, [schema])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      if (touched.current.has(String(key))) {
        const r = validate(next)
        setErrors((e) => ({ ...e, [key]: r.errors[String(key)] }))
      }
      return next
    })
  }, [validate])

  const blur = useCallback((key: keyof T) => {
    touched.current.add(String(key))
    setValues((v) => { setErrors((e) => ({ ...e, [key]: validate(v).errors[String(key)] })); return v })
  }, [validate])

  const focusFirst = (errs: Errors) => {
    const first = Object.keys(errs).find((k) => errs[k])
    if (first) requestAnimationFrame(() => document.getElementById(`${idPrefix}-${first}`)?.focus())
  }

  const submit = useCallback((onValid: (data: Out) => Promise<unknown> | void) => async (e?: React.FormEvent) => {
    e?.preventDefault()
    setFormError(null)
    Object.keys(values).forEach((k) => touched.current.add(k))
    const r = validate(values)
    setErrors(r.errors)
    if (!r.ok) { focusFirst(r.errors); return }
    try {
      await onValid(r.data)
    } catch (err) {
      if (err instanceof ApiError && err.fields) { setErrors(err.fields); focusFirst(err.fields) }
      setFormError(err instanceof Error ? err.message : 'Não foi possível concluir.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, validate])

  const bind = <K extends keyof T & string>(key: K) => ({
    id: `${idPrefix}-${key}`,
    name: key,
    value: (values[key] ?? '') as string,
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, ev.target.value as T[K]),
    onBlur: () => blur(key),
  })

  return { values, setValues, errors, setErrors, formError, setFormError, set, bind, submit }
}
