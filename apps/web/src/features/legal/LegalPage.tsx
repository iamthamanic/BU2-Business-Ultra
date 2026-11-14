/**
 * LegalPage — public privacy / terms / data-deletion pages for Meta & platform compliance.
 * Location: apps/web/src/features/legal/LegalPage.tsx
 */
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { BrandMark } from '../../components/BrandMark'
import { useI18n } from '../../lib/i18n'

export type LegalDoc = 'datenschutz' | 'nutzungsbedingungen' | 'datenloeschung'

const DOCS: LegalDoc[] = ['datenschutz', 'nutzungsbedingungen', 'datenloeschung']

/** Old EN slugs → DE (bookmarks / Meta drafts). */
export const LEGAL_SLUG_ALIASES: Record<string, LegalDoc> = {
  privacy: 'datenschutz',
  terms: 'nutzungsbedingungen',
  'data-deletion': 'datenloeschung',
  'user-data-deletion': 'datenloeschung',
}

const CONTACT_EMAIL = 'raccoova@gmail.com'
const OPERATOR = 'Raccoova'
const PRODUCT = 'Business Ultra'

function isLegalDoc(v: string | undefined): v is LegalDoc {
  return v === 'datenschutz' || v === 'nutzungsbedingungen' || v === 'datenloeschung'
}

export function resolveLegalDoc(slug: string | undefined): LegalDoc | null {
  if (!slug) return null
  if (isLegalDoc(slug)) return slug
  return LEGAL_SLUG_ALIASES[slug] ?? null
}

export function LegalIndexPage() {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  return (
    <div className="legal-page">
      <header className="legal-page-head">
        <BrandMark to="/" size="md" />
        <p className="muted legal-page-lede">
          {en ? 'Legal documents for Business Ultra.' : 'Rechtliche Dokumente für Business Ultra.'}
        </p>
      </header>
      <nav className="legal-nav" aria-label={en ? 'Legal documents' : 'Rechtliche Dokumente'}>
        {DOCS.map((doc) => (
          <Link key={doc} className="legal-nav-link" to={`/rechtliches/${doc}`}>
            {t(legalTitleKey(doc))}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function LegalPage() {
  const { doc: raw } = useParams()
  const location = useLocation()
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const doc = resolveLegalDoc(raw)
  const canonical = doc ? `/rechtliches/${doc}` : '/rechtliches'

  if (!doc) return <Navigate to="/rechtliches" replace />
  if (location.pathname !== canonical) return <Navigate to={canonical} replace />

  return (
    <div className="legal-page">
      <header className="legal-page-head">
        <BrandMark to="/" size="md" />
        <nav className="legal-nav legal-nav--inline" aria-label={en ? 'Legal documents' : 'Rechtliche Dokumente'}>
          {DOCS.map((d) => (
            <Link
              key={d}
              className={`legal-nav-link${d === doc ? ' is-active' : ''}`}
              to={`/rechtliches/${d}`}
              aria-current={d === doc ? 'page' : undefined}
            >
              {t(legalTitleKey(d))}
            </Link>
          ))}
        </nav>
      </header>

      <article className="legal-article panel">
        <h1 className="legal-title">{t(legalTitleKey(doc))}</h1>
        <div className="legal-body">{en ? bodyEn(doc) : bodyDe(doc)}</div>
      </article>

      <p className="muted legal-page-foot">
        {en ? 'Contact' : 'Kontakt'}:{' '}
        <a className="legal-mail" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
      </p>
    </div>
  )
}

function legalTitleKey(doc: LegalDoc): 'legalPrivacy' | 'legalTerms' | 'legalDataDeletion' {
  if (doc === 'datenschutz') return 'legalPrivacy'
  if (doc === 'nutzungsbedingungen') return 'legalTerms'
  return 'legalDataDeletion'
}

function bodyDe(doc: LegalDoc) {
  if (doc === 'datenschutz') {
    return (
      <>
        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlicher für die Verarbeitung personenbezogener Daten in {PRODUCT} ist {OPERATOR} (
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>).
        </p>

        <h2>2. Welche Daten wir verarbeiten</h2>
        <p>Je nach Nutzung und verbundenen Konten können wir verarbeiten:</p>
        <ul>
          <li>Account-Daten (E-Mail, Anzeigename, Rollen in einer Firma)</li>
          <li>
            Verbindungsdaten zu Drittanbietern (z. B. Meta/Facebook, Instagram, WhatsApp, Google),
            einschließlich Tokens, Account-IDs und technischer Sync-Metadaten
          </li>
          <li>
            Inhalts- und Kommunikationsdaten, die über angebundene Kanäle in die Omnichannel-Inbox
            oder Marketing-/Ads-Module fließen (Nachrichten, Kampagnen-Metadaten, Insights)
          </li>
          <li>Nutzungs- und Protokolldaten zur Absicherung und Fehlerdiagnose</li>
        </ul>

        <h2>3. Zwecke</h2>
        <ul>
          <li>Bereitstellung der Multi-Tenant-Software {PRODUCT}</li>
          <li>Verbinden und Synchronisieren von Social-/Messaging-/Ads-Konten auf Wunsch des Nutzers</li>
          <li>Auswertung und Darstellung von Ergebnissen in den Produktmodulen</li>
          <li>Sicherheit, Missbrauchsprävention und Support</li>
        </ul>

        <h2>4. Rechtsgrundlagen</h2>
        <p>
          Verarbeitung erfolgt auf Grundlage von Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO),
          berechtigtem Interesse an sicherem Betrieb (Art. 6 Abs. 1 lit. f) sowie — wo erforderlich —
          Einwilligung (Art. 6 Abs. 1 lit. a), insbesondere bei OAuth-Freigaben bei Meta und anderen
          Anbietern.
        </p>

        <h2>5. Meta- und andere Plattform-Integrationen</h2>
        <p>
          Wenn du Meta (Facebook, Instagram, WhatsApp, Meta Ads) oder andere Anbieter verbindest,
          greift {PRODUCT} nur im Umfang der von dir erteilten Berechtigungen auf Daten zu. Tokens
          werden serverseitig verschlüsselt gespeichert. Du kannst Verbindungen in den Einstellungen
          trennen; siehe auch die{' '}
          <Link to="/rechtliches/datenloeschung">Anleitung zur Löschung von Nutzerdaten</Link>.
        </p>

        <h2>6. Speicherdauer</h2>
        <p>
          Daten werden gespeichert, solange dein Account bzw. die Firmenmitgliedschaft besteht oder
          gesetzliche Aufbewahrungspflichten gelten. Nach Löschung entfernen wir Zugangsdaten und
          Verbindungs-Tokens zeitnah; Backups können kurzfristig nachlaufen.
        </p>

        <h2>7. Empfänger / Auftragsverarbeitung</h2>
        <p>
          Hosting- und Infrastrukturpartner verarbeiten Daten nur im Auftrag. Plattform-APIs (z. B.
          Meta Graph) erhalten Anfragen, die du durch die Verbindung autorisierst.
        </p>

        <h2>8. Deine Rechte</h2>
        <p>
          Du hast Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit
          und Widerspruch. Kontakt: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </>
    )
  }

  if (doc === 'nutzungsbedingungen') {
    return (
      <>
        <h2>1. Geltungsbereich</h2>
        <p>
          Diese Nutzungsbedingungen gelten für die Nutzung von {PRODUCT}, betrieben von {OPERATOR}.
          Mit der Registrierung bzw. Nutzung stimmst du diesen Bedingungen zu.
        </p>

        <h2>2. Leistung</h2>
        <p>
          {PRODUCT} ist eine Software für Marketing-, Produkt-, Kunden- und Projektarbeit inkl.
          Anbindung externer Kanäle (z. B. Meta). Funktionen können sich weiterentwickeln.
          Verfügbarkeit wird angestrebt, aber nicht ununterbrochen garantiert.
        </p>

        <h2>3. Accounts und Firmenräume</h2>
        <p>
          Du bist für Zugangsdaten und für Inhalte in deinen Firmenräumen verantwortlich.
          Administratoren entscheiden über Mitglieder und verbundene Integrationen.
        </p>

        <h2>4. Drittanbieter</h2>
        <p>
          Verbundene Dienste (Meta, Google u. a.) unterliegen zusätzlich deren Bedingungen. {PRODUCT}{' '}
          haftet nicht für Ausfälle oder Richtlinienänderungen dieser Anbieter.
        </p>

        <h2>5. Unzulässige Nutzung</h2>
        <ul>
          <li>Missbrauch von APIs, Spam oder rechtswidrige Inhalte</li>
          <li>Umgehen von Sicherheits- oder Zugriffskontrollen</li>
          <li>Nutzung entgegen geltendem Recht oder Plattformrichtlinien</li>
        </ul>

        <h2>6. Haftung</h2>
        <p>
          Für Vorsatz und grobe Fahrlässigkeit haften wir nach den gesetzlichen Vorschriften.
          Bei leichter Fahrlässigkeit ist die Haftung auf vorhersehbare, vertragstypische Schäden
          begrenzt, soweit gesetzlich zulässig.
        </p>

        <h2>7. Änderungen</h2>
        <p>
          Wir können diese Bedingungen anpassen. Wesentliche Änderungen kommunizieren wir angemessen.
          Die aktuelle Fassung steht unter dieser URL.
        </p>

        <h2>8. Kontakt</h2>
        <p>
          {OPERATOR} · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </>
    )
  }

  return (
    <>
      <h2>So löschst du deine Daten</h2>
      <p>
        Du kannst die Löschung deiner {PRODUCT}-Nutzerdaten sowie verbundener Meta-/Social-Zugänge
        wie folgt anstoßen:
      </p>
      <ol>
        <li>
          <strong>In der App:</strong> Verbindungen unter Einstellungen → Verbindungen trennen
          (entfernt Tokens und Sync für diesen Kanal).
        </li>
        <li>
          <strong>Account / Firma:</strong> Bitte einen Workspace-Admin oder schreibe an{' '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=Datenloeschung%20Business%20Ultra`}>
            {CONTACT_EMAIL}
          </a>{' '}
          mit der Bitte um Löschung (E-Mail-Adresse des Accounts angeben).
        </li>
        <li>
          <strong>Meta:</strong> Zusätzlich kannst du {PRODUCT} in den Facebook-/Meta-Einstellungen
          unter „Apps und Websites“ entfernen und damit den OAuth-Zugriff widerrufen.
        </li>
      </ol>

      <h2>Was wir löschen</h2>
      <ul>
        <li>Account-Stammdaten und Mitgliedschaften, soweit keine gesetzlichen Pflichten entgegenstehen</li>
        <li>Gespeicherte OAuth-/API-Tokens und Verbindungsdatensätze</li>
        <li>Inbox-/Integrationsdaten, die ausschließlich über deine Verbindungen entstanden sind — nach Prüfung</li>
      </ul>

      <h2>Frist</h2>
      <p>
        Wir bestätigen Löschanfragen in der Regel innerhalb von 7 Tagen und schließen die Löschung
        innerhalb von 30 Tagen ab, sofern keine Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2>Kontakt</h2>
      <p>
        Löschanfragen: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </>
  )
}

function bodyEn(doc: LegalDoc) {
  if (doc === 'datenschutz') {
    return (
      <>
        <h2>1. Controller</h2>
        <p>
          The controller for personal data in {PRODUCT} is {OPERATOR} (
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>).
        </p>

        <h2>2. Data we process</h2>
        <ul>
          <li>Account data (email, display name, company roles)</li>
          <li>
            Connection data for third-party providers (e.g. Meta/Facebook, Instagram, WhatsApp,
            Google), including tokens, account IDs, and sync metadata
          </li>
          <li>
            Content and messaging/ads data ingested into inbox or marketing modules when you connect
            channels
          </li>
          <li>Usage and log data for security and diagnostics</li>
        </ul>

        <h2>3. Purposes</h2>
        <ul>
          <li>Providing the {PRODUCT} multi-tenant product</li>
          <li>Connecting and syncing social / messaging / ads accounts at your request</li>
          <li>Showing performance and operational data in product modules</li>
          <li>Security, abuse prevention, and support</li>
        </ul>

        <h2>4. Legal bases</h2>
        <p>
          Processing is based on contract performance, legitimate interests in secure operation, and
          where required consent (including OAuth grants at Meta and other providers).
        </p>

        <h2>5. Meta and other integrations</h2>
        <p>
          When you connect Meta or other providers, {PRODUCT} only accesses data within the scopes
          you grant. Tokens are stored encrypted server-side. You can disconnect integrations in
          settings; see also the{' '}
          <Link to="/rechtliches/datenloeschung">user data deletion instructions</Link>.
        </p>

        <h2>6. Retention</h2>
        <p>
          Data is kept while your account or membership exists, or as required by law. After
          deletion we remove credentials and connection tokens promptly; backups may lag briefly.
        </p>

        <h2>7. Recipients</h2>
        <p>
          Hosting processors act on our instructions. Platform APIs receive calls you authorize by
          connecting an account.
        </p>

        <h2>8. Your rights</h2>
        <p>
          You may request access, rectification, erasure, restriction, portability, or objection.
          Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </>
    )
  }

  if (doc === 'nutzungsbedingungen') {
    return (
      <>
        <h2>1. Scope</h2>
        <p>
          These terms govern use of {PRODUCT}, operated by {OPERATOR}. By registering or using the
          product you agree to them.
        </p>

        <h2>2. Service</h2>
        <p>
          {PRODUCT} supports marketing, product, customer, and project work, including third-party
          channel connections (e.g. Meta). Features may evolve. Continuous uptime is not guaranteed.
        </p>

        <h2>3. Accounts</h2>
        <p>
          You are responsible for credentials and content in your company workspaces. Admins manage
          members and integrations.
        </p>

        <h2>4. Third parties</h2>
        <p>
          Connected services are also subject to their own terms. {PRODUCT} is not liable for those
          providers’ outages or policy changes.
        </p>

        <h2>5. Prohibited use</h2>
        <ul>
          <li>API abuse, spam, or unlawful content</li>
          <li>Bypassing security or access controls</li>
          <li>Use contrary to law or platform policies</li>
        </ul>

        <h2>6. Liability</h2>
        <p>
          Liability for intent and gross negligence follows applicable law. For slight negligence,
          liability is limited to foreseeable typical damages where permitted.
        </p>

        <h2>7. Changes</h2>
        <p>We may update these terms; the current version is published at this URL.</p>

        <h2>8. Contact</h2>
        <p>
          {OPERATOR} · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </>
    )
  }

  return (
    <>
      <h2>How to delete your data</h2>
      <ol>
        <li>
          <strong>In the app:</strong> disconnect providers under Settings → Connections (removes
          tokens/sync for that channel).
        </li>
        <li>
          <strong>Account / company:</strong> ask a workspace admin or email{' '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=Data%20deletion%20Business%20Ultra`}>
            {CONTACT_EMAIL}
          </a>{' '}
          with your account email and a deletion request.
        </li>
        <li>
          <strong>Meta:</strong> remove {PRODUCT} under Facebook/Meta Settings → Apps and Websites to
          revoke OAuth access.
        </li>
      </ol>

      <h2>What we delete</h2>
      <ul>
        <li>Account profile data and memberships, unless legal retention applies</li>
        <li>Stored OAuth/API tokens and connection records</li>
        <li>Integration/inbox data created solely via your connections — after review</li>
      </ul>

      <h2>Timeline</h2>
      <p>
        We typically acknowledge requests within 7 days and complete deletion within 30 days unless
        retention rules require otherwise.
      </p>

      <h2>Contact</h2>
      <p>
        Deletion requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </>
  )
}
