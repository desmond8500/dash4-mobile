import { describe, expect, it } from 'vitest'
import { contactChannels } from '../src/utils/links'

describe('contacts liés sur le téléphone', () => {
  it('réunit les téléphones et e-mails du contact sans doublon', () => {
    expect(
      contactChannels({
        phone: '77 000 00 00',
        email: ' awa@example.com ',
        phones: [{ number: '77 000 00 00' }, { number: '33 800 00 00' }],
        emails: [{ address: 'awa@example.com' }],
      }),
    ).toEqual({ phones: ['77 000 00 00', '33 800 00 00'], emails: ['awa@example.com'] })
    expect(contactChannels({})).toEqual({ phones: [], emails: [] })
  })
})
