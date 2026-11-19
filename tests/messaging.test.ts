import { describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@dash4/shared'
import type { OutboxItem } from '../src/offline/outbox'
import { findDirect, mergeThread, pendingConversations, pendingMessages, unreadTotal } from '../src/utils/messaging'
import { visibleTabs } from '../src/tabs'

const conv = (id: number, type: 'direct' | 'group', memberIds: number[], unread = 0) =>
  ({ id, type, members: memberIds.map((m) => ({ id: m, full_name: `U${m}` })), unread_count: unread }) as unknown as Conversation
const item = (path: string, method = 'POST') => ({ id: path, type: 'message', label: '', method, path, payload: {}, attempts: 0, createdAt: 0 }) as unknown as OutboxItem

describe('messagerie hors ligne', () => {
  it('reprend la conversation privée connue', () => {
    const list = [conv(1, 'group', [1, 2]), conv(2, 'direct', [1, 3])]
    expect(findDirect(list, 3)?.id).toBe(2)
    expect(findDirect(list, 2)).toBeUndefined()
  })

  it('retrouve les envois en attente, par id ou identifiant hors ligne', () => {
    const pending = [item('conversations/4/messages'), item('conversations/abc/messages'), item('conversations'), item('messages/9', 'DELETE')]
    expect(pendingMessages(pending, [4, 'abc'])).toHaveLength(2)
    expect(pendingConversations(pending)).toHaveLength(1)
  })

  it('fusionne en gardant les suppressions et compte les non lus', () => {
    const m = (id: number, body: string | null, deleted_at: string | null = null) => ({ id, body, deleted_at }) as Message
    expect(mergeThread([m(1, 'a'), m(2, 'b')], [m(2, null, 'x'), m(3, 'c')]).map((x) => x.body)).toEqual(['a', null, 'c'])
    expect(unreadTotal([conv(1, 'group', [], 2), conv(2, 'direct', [], 3)])).toBe(5)
  })

  it('donne l’onglet Messages à tous les comptes', () => {
    expect(visibleTabs('technician', () => false).map((t) => t.name)).toContain('messages')
    expect(visibleTabs('manager', () => false).map((t) => t.name)).toContain('messages')
  })
})
