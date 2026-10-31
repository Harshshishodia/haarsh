export type ConciergeLanguage = 'English' | 'हिन्दी' | 'Hinglish' | 'ਪੰਜਾਬੀ'

const unknown = 'I do not have a confirmed answer for that yet. Please ask the family desk so nobody receives an unverified promise.'

export function conciergeReply(question: string, language: ConciergeLanguage = 'English') {
  const q = question.trim().toLowerCase()
  let answer = unknown
  if (/^(hi|hello|hey|namaste|namaskar|sat sri akal)\b/.test(q)) answer = 'Namaste Ji. I can help with the wedding dates, invitation, RSVP, venue and Baraat tracking.'
  else if (/whose wedding|who.*marry|bride|groom|couple|name/.test(q)) answer = 'This is Vaishnavi and Dhruv’s wedding celebration Ji.'
  else if (/when|date|day/.test(q) && /wedding|shaadi|celebrat/.test(q)) answer = 'The celebrations are planned for 12–16 February 2027 in Ghaziabad. The wedding is on Tuesday, 16 February.'
  else if (/sagai/.test(q)) answer = 'Sagai is planned for 12 February 2027. Its time and venue are still to be confirmed.'
  else if (/haldi/.test(q)) answer = 'Haldi is planned for 14 February 2027. Its time and venue are still to be confirmed.'
  else if (/mehndi/.test(q)) answer = 'Mehndi is planned for 15 February 2027. Its time and venue are still to be confirmed.'
  else if (/sangeet/.test(q)) answer = unknown
  else if (/time|kitne baje|timing/.test(q)) answer = 'The event times are still to be confirmed. The wedding desk will publish them after the family confirms them.'
  else if (/venue|where|location|address|reach|direction/.test(q)) answer = 'The wedding venue is Emerald Green, Govindpuram, Ghaziabad. Other event venues are still to be confirmed. Please use the directions on your private pass before travelling.'
  else if (/rsvp|coming|attend/.test(q)) answer = 'Open RSVP from the wedding home, choose each household member’s attendance, and save it. You can update it again before the family closes RSVPs.'
  else if (/baraat|track|live/.test(q)) answer = 'Open Baraat from the top menu for the family-approved live route and status. Live location appears only while an authorised tracker is sharing it.'
  else if (/phone|number|privacy|data/.test(q)) answer = 'Guest phone numbers stay private. Verified members may see names and wedding activity, and you can request a data export or deletion from your profile.'
  if (language === 'हिन्दी') return `जी, ${answer}`
  if (language === 'Hinglish') return answer.replace('Please', 'Kripya')
  if (language === 'ਪੰਜਾਬੀ') return `ਜੀ, ${answer}`
  return answer
}
