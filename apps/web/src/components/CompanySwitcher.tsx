/**
 * CompanySwitcher — switch / create / list companies.
 * Dropdown mode kept for reuse; Settings embeds `variant="panel"`.
 * Location: apps/web/src/components/CompanySwitcher.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretDown } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { companyBase } from '../lib/companyPaths'
import { useI18n } from '../lib/i18n'

type Biz = {
  id: string
  name: string
  slug: string
  status: string
  role?: string
  logoPath?: string | null
}

type Props = {
  activeSlug?: string
  activeName?: string
  activeLogoPath?: string | null
  canCreate?: boolean
  /** `dropdown` = topbar chip; `panel` = Settings Companies section */
  variant?: 'dropdown' | 'panel'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function LogoMark({
  name,
  logoPath,
  className,
}: {
  name: string
  logoPath?: string | null
  className: string
}) {
  if (logoPath) {
    return (
      <span className={`${className} has-img`}>
        <img src={logoPath} alt="" />
      </span>
    )
  }
  return <span className={className}>{initials(name)}</span>
}

export function CompanySwitcher({
  activeSlug,
  activeName,
  activeLogoPath,
  canCreate = true,
  variant = 'dropdown',
}: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [list, setList] = useState<Biz[]>([])
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    api<{ businesses: Biz[] }>('/api/businesses')
      .then((r) => {
        if (!cancelled) setList(r.businesses.filter((b) => b.status !== 'archived'))
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (variant === 'panel') return
    if (!open && !creating) return
    function onDoc(ev: MouseEvent) {
      if (!hostRef.current?.contains(ev.target as Node)) {
        setOpen(false)
        setCreating(false)
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, creating, variant])

  const label = activeName || activeSlug || t('noCompany')

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  }

  async function createCompany() {
    const n = name.trim()
    if (!n) {
      setMsg(t('nameRequired'))
      return
    }
    const s = slug.trim() || slugify(n)
    if (!s) {
      setMsg(t('nameRequired'))
      return
    }
    setMsg(t('creating'))
    try {
      const r = await api<{ business: Biz }>('/api/businesses', {
        method: 'POST',
        body: JSON.stringify({ name: n, slug: s }),
      })
      setCreating(false)
      setOpen(false)
      setName('')
      setSlug('')
      setMsg('')
      navigate(companyBase(r.business.slug))
    } catch (e) {
      setMsg(String(e))
    }
  }

  function goCompany(nextSlug: string) {
    setOpen(false)
    navigate(companyBase(nextSlug))
  }

  const companyList = (
    <>
      {!list.length ? (
        <div className="hdr-company-empty">{err || t('noCompany')}</div>
      ) : (
        list.map((c) => (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={c.slug === activeSlug}
            className={`hdr-company-item${c.slug === activeSlug ? ' active' : ''}`}
            onClick={() => goCompany(c.slug)}
          >
            <LogoMark name={c.name} logoPath={c.logoPath} className="hdr-company-item-logo" />
            <span className="hdr-company-item-name">{c.name}</span>
          </button>
        ))
      )}
      {canCreate && (
        <button
          type="button"
          className="hdr-company-item create"
          onClick={() => {
            setOpen(false)
            setCreating(true)
            setMsg('')
          }}
        >
          {t('createCompanyPlus')}
        </button>
      )}
      <button
        type="button"
        className="hdr-company-item"
        onClick={() => {
          setOpen(false)
          setCreating(false)
          navigate('/')
        }}
      >
        {t('allCompanies')}
      </button>
    </>
  )

  const createForm = creating ? (
    <div className={variant === 'panel' ? 'hdr-company-panel inline' : 'hdr-company-panel'}>
      <div className="hdr-chip-kicker">{t('newCompany')}</div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('companyNamePh')}
        autoComplete="organization"
        autoFocus
      />
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={t('companySlugPh')}
        autoComplete="off"
      />
      <div className="hdr-actions">
        <button type="button" onClick={() => setCreating(false)}>
          {t('cancel')}
        </button>
        <button type="button" data-save onClick={() => void createCompany()}>
          {t('create')}
        </button>
      </div>
      {msg ? <div data-msg>{msg}</div> : null}
    </div>
  ) : null

  if (variant === 'panel') {
    return (
      <div className="settings-companies" data-bu-company-switcher="1">
        <div className="settings-companies-current">
          <LogoMark
            name={label}
            logoPath={activeLogoPath}
            className="hdr-company-logo"
          />
          <div className="settings-companies-current-text">
            <span className="hdr-chip-kicker">{t('company')}</span>
            <strong>{label}</strong>
          </div>
        </div>
        {!creating ? (
          <div className="hdr-company-menu open settings-companies-list" role="listbox">
            {companyList}
          </div>
        ) : null}
        {createForm}
      </div>
    )
  }

  return (
    <div className="hdr-company" ref={hostRef} data-bu-company-switcher="1">
      <button
        type="button"
        className="hdr-company-btn"
        aria-haspopup="listbox"
        aria-expanded={open || creating}
        aria-label={t('pickCompany')}
        onClick={() => {
          setCreating(false)
          setOpen((v) => !v)
        }}
      >
        <LogoMark
          name={label}
          logoPath={activeLogoPath}
          className="hdr-company-logo"
        />
        <span className="hdr-chip-kicker">{t('company')}</span>
        <span className="hdr-chip-value">{label}</span>
        <CaretDown className="hdr-company-chevron" size={14} weight="bold" aria-hidden />
      </button>

      {open && !creating ? (
        <div className="hdr-company-menu open" role="listbox">
          {companyList}
        </div>
      ) : null}

      {createForm}
    </div>
  )
}
