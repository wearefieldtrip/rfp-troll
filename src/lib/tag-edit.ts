// What saving the Edit tags dialog changes. A group the person changed is theirs from then on (confirmed);
// a group they left alone stays as the AI set it.

export type CurrentTag = { id: string; tag_value_id: string; tag_group: string; confirmed: boolean }

export type TagSavePlan = {
  /** rfp_tags rows to remove. */
  removeIds: string[]
  /** tag values to add, as confirmed tags a person chose. */
  addValueIds: string[]
  /** rfp_tags rows that stay but are now confirmed, because their group was changed. */
  confirmIds: string[]
  /** The groups that changed, for the message after saving. */
  changedGroups: string[]
}

/** `selected` has one entry per group the dialog showed: the tag value ids now chosen in it. */
export function planTagSave(current: CurrentTag[], selected: Map<string, Set<string>>): TagSavePlan {
  const plan: TagSavePlan = { removeIds: [], addValueIds: [], confirmIds: [], changedGroups: [] }

  for (const [group, chosen] of selected) {
    const rows = current.filter((c) => c.tag_group === group)
    const have = new Set(rows.map((r) => r.tag_value_id))
    const same = have.size === chosen.size && [...chosen].every((id) => have.has(id))
    if (same) continue

    plan.changedGroups.push(group)
    for (const row of rows) {
      if (!chosen.has(row.tag_value_id)) plan.removeIds.push(row.id)
      else if (!row.confirmed) plan.confirmIds.push(row.id)
    }
    for (const id of chosen) if (!have.has(id)) plan.addValueIds.push(id)
  }
  return plan
}

/** Picks a value in a group: one-value groups hold just that value (picking it again clears it); many-value groups toggle. */
export function toggleChoice(chosen: Set<string>, id: string, many: boolean): Set<string> {
  const next = new Set(many ? chosen : [])
  if (chosen.has(id)) next.delete(id)
  else next.add(id)
  return next
}
