/**
 * Time utilities — all timestamps displayed in EST/EDT
 */

const EST_TIMEZONE = 'America/New_York'

/**
 * Format a timestamp as a readable date+time in EST
 * e.g. "Jun 9, 2026, 10:30 AM"
 */
export function formatDateTime(isoString) {
  if (!isoString) return '—'
  const ts = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  return new Date(ts).toLocaleString('en-US', {
    timeZone:    EST_TIMEZONE,
    month:       'short',
    day:         'numeric',
    year:        'numeric',
    hour:        '2-digit',
    minute:      '2-digit',
    hour12:      true,
  })
}

/**
 * Format just the date in EST
 * e.g. "Jun 9, 2026"
 */
export function formatDate(isoString) {
  if (!isoString) return '—'
  const ts = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  return new Date(ts).toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    month:    'short',
    day:      'numeric',
    year:     'numeric',
  })
}

/**
 * Format just the time in EST
 * e.g. "10:30 AM EST"
 */
export function formatTime(isoString) {
  if (!isoString) return '—'
  const ts = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  return new Date(ts).toLocaleTimeString('en-US', {
    timeZone:     EST_TIMEZONE,
    hour:         '2-digit',
    minute:       '2-digit',
    hour12:       true,
    timeZoneName: 'short',
  })
}

/**
 * Human-readable relative time
 * e.g. "2m ago", "3h ago"
 * Falls back to formatted date for old timestamps
 */
export function timeAgo(isoString) {
  if (!isoString) return '—'
  const ts   = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)

  if (diff < 0)      return 'just now'
  if (diff < 60)     return `${diff}s ago`
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`

  // Older than a week — show actual date in EST
  return formatDate(isoString)
}

/**
 * Full date+time with relative for recent items
 * e.g. "2m ago · Jun 9, 2026, 10:30 AM EST"
 */
export function formatFull(isoString) {
  if (!isoString) return '—'
  return `${timeAgo(isoString)} · ${formatDateTime(isoString)}`
}

/**
 * Greeting based on EST time of day
 */
export function getTimeGreeting(name) {
  const hour = new Date().toLocaleString('en-US', {
    timeZone: EST_TIMEZONE,
    hour:     'numeric',
    hour12:   false,
  })
  const h = parseInt(hour)
  if (h < 12) return `Good morning, ${name} ☀️`
  if (h < 17) return `Good afternoon, ${name} 👋`
  if (h < 21) return `Good evening, ${name} 🌆`
  return `Working late, ${name}? 🌙`
}
