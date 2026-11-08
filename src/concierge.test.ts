import { describe, expect, it } from 'vitest'
import { conciergeAnswer, conciergeReply } from './concierge'

describe('conciergeReply', () => {
  it('answers greetings and known wedding facts', () => {
    expect(conciergeReply('hi')).toContain('Namaste')
    expect(conciergeReply('Whose wedding is this?')).toContain('Vaishnavi and Dhruv')
    expect(conciergeReply('Where is the wedding?')).toContain('Emerald Green')
    expect(conciergeReply('Give me directions')).toContain('google.com/maps')
  })
  it('handles conversation, typos and context',()=>{
    expect(conciergeReply('how are you?')).toContain('doing well')
    expect(conciergeReply('location of marrage')).toContain('Emerald Green')
    expect(conciergeAnswer('send link','English','venue').actions?.[0].href).toContain('google.com/maps')
  })
  it('marks unknown or unconfirmed facts honestly', () => {
    expect(conciergeReply('What is the Sangeet time?')).toContain('do not have a confirmed answer')
    expect(conciergeReply('What time is the wedding?')).toContain('still to be confirmed')
  })
})
