import { describe, expect, it, vi } from 'vitest'
import { handleTelegramUpdate } from './telegram.js'

const options = () => ({
  hashPhone: (value: string) => value,
  hashCode: (value: string) => value,
  send: vi.fn(async () => '1'),
})

describe('Telegram wedding assistant', () => {
  it('answers an ordinary private message', async () => {
    const deps = options()
    const result = await handleTelegramUpdate({
      update_id: 1,
      message: { chat: { id: 10, type: 'private' }, from: { id: 10 }, text: 'When is the wedding?' },
    }, deps)
    expect(result).toMatchObject({ replied: true, intent: 'wedding_date' })
    expect(deps.send).toHaveBeenCalledWith('10', expect.stringContaining('16 February 2027'))
  })

  it('rejects a contact belonging to somebody else', async () => {
    const deps = options()
    const result = await handleTelegramUpdate({
      update_id: 2,
      message: {
        chat: { id: 10, type: 'private' },
        from: { id: 10 },
        contact: { user_id: 11, phone_number: '+919999999999' },
      },
    }, deps)
    expect(result).toMatchObject({ contactRejected: true })
  })

  it('keeps verification out of group chats', async () => {
    const deps = options()
    const result = await handleTelegramUpdate({
      update_id: 3,
      message: { chat: { id: -10, type: 'group' }, from: { id: 10 }, text: '/start ABCDEF1234' },
    }, deps)
    expect(result).toMatchObject({ privateChatRequired: true })
  })
})
