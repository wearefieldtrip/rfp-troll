// The Slack message posted when a new RFP's first review finishes. Pure, so it is tested.
// It carries only the title, client, services asked for, a one-sentence description and a link: no fit score,
// risks, questions or RFP text. An identical copy lives in supabase/functions/review-rfp/.

export type NewRfpNotice = {
  title: string
  clientName: string | null
  services: string[]
  /** One plain sentence on what the issuer is asking for. */
  description: string | null
  /** The address of the app, with no trailing slash, or null when it isn't configured. */
  appUrl: string | null
  rfpId: string
}

/** Slack reads &, < and > as markup; everything the message quotes is escaped. */
const escapeSlack = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** The message text, in Slack's mrkdwn. */
export function newRfpMessage(n: NewRfpNotice): string {
  const title = escapeSlack(oneLine(n.title))
  const client = n.clientName ? escapeSlack(oneLine(n.clientName)) : ''
  const lines = [`*There is a new RFP to view*`, `*${title}*${client ? ` · ${client}` : ''}`]
  const services = n.services.map((s) => escapeSlack(oneLine(s))).filter(Boolean)
  if (services.length > 0) lines.push(`Services asked for: ${services.join(', ')}`)
  const description = n.description ? escapeSlack(oneLine(n.description)) : ''
  if (description) lines.push(description)
  if (n.appUrl) lines.push(`<${n.appUrl.replace(/\/+$/, '')}/rfps/${n.rfpId}|Open in RFP Troll>`)
  return lines.join('\n')
}
