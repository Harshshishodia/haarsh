export type ConciergeLanguage = 'English' | 'हिन्दी' | 'Hinglish' | 'ਪੰਜਾਬੀ'
export type ConciergeIntent = 'greeting'|'smalltalk'|'couple'|'date'|'schedule'|'venue'|'directions'|'rsvp'|'baraat'|'privacy'|'thanks'|'help'|'unknown'
export type ConciergeResult = { text:string; intent:ConciergeIntent; actions?:{label:string;tab:'pass'|'rsvp'|'track'|'profile';href?:string}[] }
const MAPS='https://www.google.com/maps/search/?api=1&query=Emerald+Green+Govindpuram+Ghaziabad'
const unknown='I do not have a confirmed answer for that yet. I can record a question for the family desk without making an unverified promise.'
// Wedding queries can contain Hindi and Punjabi combining marks.
// eslint-disable-next-line no-misleading-character-class
function normalise(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9\u0900-\u097f\u0a00-\u0a7f\s]/g,' ').replace(/\s+/g,' ').replace(/marr?ai?ge|marrage|shadi/g,'wedding').replace(/locatoin|loction|locaton/g,'location').replace(/weding/g,'wedding').replace(/barat/g,'baraat')}
function localise(text:string,language:ConciergeLanguage){if(language==='Hinglish')return text.replace('I am doing well and ready to help.','Main bilkul theek hoon aur help ke liye ready hoon Ji.').replace('Thank you.','Shukriya Ji.');if(language==='हिन्दी')return `जी, ${text}`;if(language==='ਪੰਜਾਬੀ')return `ਜੀ, ${text}`;return text}
export function conciergeAnswer(question:string,language:ConciergeLanguage='English',previous?:ConciergeIntent):ConciergeResult{
 const q=normalise(question);let intent:ConciergeIntent='unknown',text=unknown,actions:ConciergeResult['actions']
 if(/^(hi|hello|hey|namaste|namaskar|sat sri akal)\b/.test(q)){intent='greeting';text='Namaste Ji. Ask naturally about Vaishnavi and Dhruv’s wedding, your invitation, RSVP, venue, directions or Baraat tracking.'}
 else if(/how are you|how r u|kaise ho|kaisi ho/.test(q)){intent='smalltalk';text='I am doing well and ready to help. How can I make the wedding easier for you today?';actions=[{label:'View my pass',tab:'pass'},{label:'Update RSVP',tab:'rsvp'}]}
 else if(/thank|shukriya|dhanyavad/.test(q)){intent='thanks';text='Thank you. It is a pleasure to help Ji.'}
 else if(/bye|good night|see you/.test(q)){intent='smalltalk';text='See you at the celebrations Ji. You can return here whenever you need help.'}
 else if(/what can you|help|options/.test(q)){intent='help';text='I can explain confirmed dates and venues, open directions, help with your private pass and RSVP, explain privacy, and show Baraat tracking.';actions=[{label:'My pass',tab:'pass'},{label:'RSVP',tab:'rsvp'},{label:'Baraat',tab:'track'}]}
 else if(/whose wedding|who.*marr|bride|groom|couple|names?/.test(q)){intent='couple';text='This is Vaishnavi and Dhruv’s wedding celebration Ji.'}
 else if(/sagai/.test(q)){intent='schedule';text='Sagai is planned for 12 February 2027. Its time and venue are still to be confirmed.';actions=[{label:'Full schedule',tab:'pass'}]}
 else if(/haldi/.test(q)){intent='schedule';text='Haldi is planned for 14 February 2027. Its time and venue are still to be confirmed.';actions=[{label:'Full schedule',tab:'pass'}]}
 else if(/mehndi/.test(q)){intent='schedule';text='Mehndi is planned for 15 February 2027. Its time and venue are still to be confirmed.';actions=[{label:'Full schedule',tab:'pass'}]}
 else if(/sangeet/.test(q)){intent='schedule';text='I do not have a confirmed answer for the Sangeet yet. It appears only for households invited after the family confirms it.'}
 else if(/map|direction|navigate|reach|route/.test(q)||(previous==='venue'&&/there|link|open/.test(q))){intent='directions';text=`Open Google Maps for Emerald Green, Govindpuram, Ghaziabad: ${MAPS} . Please check the final event card before travelling because other venues remain unconfirmed.`;actions=[{label:'Open Google Maps',tab:'pass',href:MAPS}]}
 else if(/venue|where|location|address/.test(q)){intent='venue';text='The confirmed wedding venue is Emerald Green, Govindpuram, Ghaziabad. Other event venues are still to be confirmed.';actions=[{label:'Get directions',tab:'pass',href:MAPS}]}
 else if((/when|date|day/.test(q)&&/wedding|celebrat/.test(q))||q==='when'){intent='date';text='The celebrations are planned for 12–16 February 2027 in Ghaziabad. The wedding is Tuesday, 16 February; its start time is still to be confirmed.';actions=[{label:'View schedule',tab:'pass'}]}
 else if(/time|kitne baje|timing|schedule/.test(q)){intent='schedule';text='Event times are still to be confirmed. Your schedule shows only the events included on your household pass.';actions=[{label:'My schedule',tab:'pass'}]}
 else if(/rsvp|coming|attend/.test(q)){intent='rsvp';text='Open RSVP, choose attendance for each invited household member and save. Events outside your household pass cannot be submitted.';actions=[{label:'Update RSVP',tab:'rsvp'}]}
 else if(/baraat|track|live/.test(q)){intent='baraat';text='Baraat tracking shows a family-approved live position only while an authorised groom-side phone is sharing. Otherwise it clearly says “Not started yet”.';actions=[{label:'Open Baraat tracker',tab:'track'}]}
 else if(/phone|number|privacy|data|delete/.test(q)){intent='privacy';text='Phone numbers stay private. Only a server-verified member can access private wedding data. Your profile includes download and delete-data controls.';actions=[{label:'Privacy & profile',tab:'profile'}]}
 return {text:localise(text,language),intent,actions}
}
export function conciergeReply(question:string,language:ConciergeLanguage='English',previous?:ConciergeIntent){return conciergeAnswer(question,language,previous).text}
