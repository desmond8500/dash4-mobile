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
