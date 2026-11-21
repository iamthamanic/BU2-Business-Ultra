# business-ultra-legal

Statische Legal-Seiten für Meta (Datenschutz / Nutzungsbedingungen / Datenlöschung).

Ziel-Domain: `business-ultra.raccoova.com`  
Hosting: Hostinger VPS (IONOS nur DNS).

## URLs

- https://business-ultra.raccoova.com/rechtliches/datenschutz/
- https://business-ultra.raccoova.com/rechtliches/nutzungsbedingungen/
- https://business-ultra.raccoova.com/rechtliches/datenloeschung/

## Inhalt

```
index.html            # Weiterleitung → /rechtliches/
app-icon-1024.png
rechtliches/styles.css    # einziges Stylesheet (auch von index.html genutzt)
rechtliches/brand/bu-mark.png
rechtliches/...
```

## Hinweis Docker / volle App

Für Meta reichen diese **statischen** Seiten.
Das komplette BU2 (Web + API + Postgres) kommt später als eigener Docker-Stack auf demselben VPS — das ist ein separates Setup, nicht nötig nur für die Legal-URLs.
