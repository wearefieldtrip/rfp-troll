// The Slack message posted when a new RFP's first review finishes. Pure, so it is tested.
// It carries only the title, client, services asked for, a one-sentence description, the key dates and a link: no fit
// score, risks, questions or RFP text. An identical copy lives in supabase/functions/review-rfp/.
import { momentFrom, type MomentRow } from './moment-columns.ts'
import { formatMoment } from './rfp-dates.ts'

export type NewRfpNotice = {
  title: string
  clientName: string | null
  services: string[]
  /** One plain sentence on what the issuer is asking for. */
  description: string | null
  /** The RFP's stored dates, shown with their time and time zone when the RFP gives them. Null leaves the dates out. */
  dates?: (MomentRow & { questions_policy: string }) | null
  /** The address of the app, with no trailing slash, or null when it isn't configured. */
  appUrl: string | null
  rfpId: string
}

/** Slack reads &, < and > as markup; everything the message quotes is escaped. */
const escapeSlack = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** The three key dates as label and value, each with its time and time zone as the RFP gives them. A missing date says so: "Not stated" is never "Not allowed". */
export function keyDates(row: MomentRow & { questions_policy: string }): { label: string; value: string }[] {
  const proposal = momentFrom(row, 'proposal_due')
  const questions = momentFrom(row, 'questions_due')
  const vendor = momentFrom(row, 'vendor_selection')
  const questionsText = row.questions_policy === 'not_allowed' ? 'Not allowed' : row.questions_policy === 'due' && questions ? formatMoment(questions) : 'Not stated'
  return [
    { label: 'Proposal due', value: proposal ? formatMoment(proposal) : 'Not stated' },
    { label: 'Questions due', value: questionsText },
    { label: 'Vendor selected', value: vendor ? formatMoment(vendor) : 'Not stated' },
  ]
}

export const keyDateLines = (row: MomentRow & { questions_policy: string }): string[] => keyDates(row).map((d) => `${d.label}: ${d.value}`)

/** The message text, in Slack's mrkdwn. */
export function newRfpMessage(n: NewRfpNotice): string {
  const title = escapeSlack(oneLine(n.title))
  const client = n.clientName ? escapeSlack(oneLine(n.clientName)) : ''
  const lines = [`*There is a new RFP to view*`, `*${title}*${client ? ` · ${client}` : ''}`]
  const services = n.services.map((s) => escapeSlack(oneLine(s))).filter(Boolean)
  if (services.length > 0) lines.push(`Services asked for: ${services.join(', ')}`)
  const description = n.description ? escapeSlack(oneLine(n.description)) : ''
  if (description) lines.push(description)
  if (n.dates) lines.push(`*Key dates*`, ...keyDateLines(n.dates).map(escapeSlack))
  if (n.appUrl) lines.push(`<${n.appUrl.replace(/\/+$/, '')}/rfps/${n.rfpId}|Open in RFP Troll>`)
  return lines.join('\n')
}

type Block = Record<string, unknown>

/**
 * The same notice laid out with Slack blocks, so it has a hierarchy: a heading, the RFP's title in bold with the client
 * under it, the description, then the services and the key dates in labeled columns, and a button to the RFP.
 * The plain `newRfpMessage` text goes with it as the notification preview and for clients that can't show blocks.
 */
export function newRfpBlocks(n: NewRfpNotice): Block[] {
  const title = escapeSlack(oneLine(n.title))
  const client = n.clientName ? escapeSlack(oneLine(n.clientName)) : ''
  const services = n.services.map((s) => escapeSlack(oneLine(s))).filter(Boolean)
  const description = n.description ? escapeSlack(oneLine(n.description)) : ''

  const blocks: Block[] = [
    { type: 'header', text: { type: 'plain_text', text: 'New RFP to view', emoji: false } },
    { type: 'section', text: { type: 'mrkdwn', text: `*${title}*` } },
  ]
  if (client) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: client }] })
  if (description) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: description } })
  blocks.push({ type: 'divider' })
  if (services.length > 0) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Services asked for*\n${services.join(' · ')}` } })
  if (n.dates) {
    blocks.push({ type: 'section', fields: keyDates(n.dates).map((d) => ({ type: 'mrkdwn', text: `*${d.label}*\n${escapeSlack(d.value)}` })) })
  }
  if (n.appUrl) {
    blocks.push({
      type: 'actions',
      elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in RFP Troll', emoji: false }, url: `${n.appUrl.replace(/\/+$/, '')}/rfps/${n.rfpId}`, style: 'primary' }],
    })
  }
  return blocks
}
