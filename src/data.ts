export type EventName = 'Sagai' | 'Haldi' | 'Mehndi' | 'Wedding'
export const events = [
  { name: 'Sagai' as EventName, date: '12 Feb', day: 'Friday', venue: 'To be confirmed', time: 'To be confirmed', accent: '#d5924d' },
  { name: 'Haldi' as EventName, date: '14 Feb', day: 'Sunday', venue: 'To be confirmed', time: 'To be confirmed', accent: '#dcae43' },
  { name: 'Mehndi' as EventName, date: '15 Feb', day: 'Monday', venue: 'To be confirmed', time: 'To be confirmed', accent: '#769160' },
  { name: 'Wedding' as EventName, date: '16 Feb', day: 'Tuesday', venue: 'Emerald Green · Govindpuram', time: 'To be confirmed', accent: '#7b3543' },
]

export const stories = [
  { initials: 'V&D', name: 'Wedding desk', color: '#7b3543' },
  { initials: 'VS', name: 'Vaishnavi', color: '#c98f77' },
  { initials: 'DS', name: 'Dhruv', color: '#5f746f' },
  { initials: 'AS', name: 'Anita Ji', color: '#b68a4c' },
  { initials: 'SS', name: 'Sanjeev Ji', color: '#6d5354' },
]

export const posts = [
  { id: 1, author: 'Wedding desk', when: 'Pinned', event: 'Wedding', title: 'A warm welcome to our wedding home', body: 'Everything you need for the celebrations lives here. Your invited events, RSVP, travel help and family updates will always stay together.', likes: 84, comments: 12, gradient: 'arch' },
  { id: 2, author: 'Vaishnavi & Dhruv', when: '2h', event: 'Mehndi', title: 'The countdown begins', body: 'Bring your brightest smiles and your dancing shoes. We cannot wait to celebrate with all of you.', likes: 126, comments: 28, gradient: 'petals' },
]

export const managerStats = [
  { label: 'Guests', value: '612', note: '418 confirmed' },
  { label: 'Open requests', value: '18', note: '4 need attention' },
  { label: 'Budget tracked', value: '₹18.4L', note: '₹6.2L remaining' },
  { label: 'Tasks', value: '73%', note: '27 of 101 open' },
]

export const requests = [
  { guest: 'Meera & family', request: 'Airport pickup · T3', owner: 'Rahul', state: 'Assigned', due: '15 Feb' },
  { guest: 'Dadi Ji', request: 'Wheelchair access at venue', owner: 'Harsh', state: 'In progress', due: '16 Feb' },
  { guest: 'Arjun Malhotra', request: 'Room check-in details', owner: 'Unassigned', state: 'New', due: '14 Feb' },
]

export const vendors = [
  { name: 'Emerald Green', category: 'Venue', amount: '₹7,50,000', status: 'Part paid' },
  { name: 'Shagun Décor', category: 'Décor', amount: '₹3,20,000', status: 'Deposit due' },
  { name: 'Rasoi Collective', category: 'Catering', amount: '₹4,80,000', status: 'Confirmed' },
  { name: 'Frame & Vows', category: 'Photo + film', amount: '₹2,30,000', status: 'Confirmed' },
]
