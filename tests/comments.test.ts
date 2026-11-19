import { describe, expect, it } from 'vitest'
import { filterMentionable, insertMention, mentionedIds, mentionQuery } from '@dash4/shared'

const people = [
  { id: 1, full_name: 'Awa Ndiaye' },
  { id: 2, full_name: 'Moussa Diop' },
]

describe('commentaires sur le téléphone', () => {
  it('propose les personnes après @ et garde les ids des personnes citées', () => {
    const typed = 'Il manque une caméra @mou'
    const q = mentionQuery(typed, typed.length)
    expect(q?.query).toBe('mou')
    expect(filterMentionable(people, q!.query).map((p) => p.id)).toEqual([2])
    const { text } = insertMention(typed, q!.start, typed.length, people[1]!)
    expect(text).toBe('Il manque une caméra @Moussa Diop ')
    expect(mentionedIds(text, people)).toEqual([2])
  })
})

describe('notifications sur le téléphone', () => {
  it('ouvre l\'écran de la fiche concernée', async () => {
    const { notificationRoute } = await import('../src/utils/notifications')
    const n = (patch: Record<string, unknown>) => ({ id: 'x', kind: 'comment.mention', title: '', body: '', read_at: null, created_at: null, ...patch })
    expect(notificationRoute(n({ subject_type: 'tasks', subject_id: 4 }))).toEqual({ name: 'task', params: { id: 4 } })
    expect(notificationRoute(n({ subject_type: 'brands', subject_id: 4 }))).toBeNull()
    expect(notificationRoute(n({ kind: 'tech_share.received', tech_share_id: 9 }))).toEqual({ name: 'tech-share', params: { id: 9 } })
  })
})
