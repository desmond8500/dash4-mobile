import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@dash4/shared'
import { notificationRoute } from '../src/utils/notifications'

describe('chantier affecté à un technicien', () => {
  it('la notification ouvre le chantier', () => {
    const n = { id: 'x', kind: 'site.assigned', project_id: 12, title: 'Chantier affecté : Hôtel Teranga', body: '', read_at: null, created_at: '' } as unknown as AppNotification
    expect(notificationRoute(n)).toEqual({ name: 'site', params: { projectId: 12 } })
  })
})
