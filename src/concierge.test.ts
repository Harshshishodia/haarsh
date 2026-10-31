import { describe, expect, it } from 'vitest'
import { conciergeReply } from './concierge'

describe('conciergeReply', () => {
  it('answers greetings and known wedding facts', () => {
    expect(conciergeReply('hi')).toContain('Namaste')
    expect(conciergeReply('Whose wedding is this?')).toContain('Vaishnavi and Dhruv')
    expect(conciergeReply('Where is the wedding?')).toContain('Emerald Green')
  })
  it('marks unknown or unconfirmed facts honestly', () => {
    expect(conciergeReply('What is the Sangeet time?')).toContain('do not have a confirmed answer')
    expect(conciergeReply('What time is the wedding?')).toContain('still to be confirmed')
  })
})
