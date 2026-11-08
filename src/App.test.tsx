import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('V&D wedding concierge', () => {
  afterEach(()=>vi.unstubAllGlobals())
  async function enterPreview() {
    fireEvent.click(await screen.findByRole('button', { name: /explore the sample/i }))
  }
  it('opens the private wedding pass from the guest home', async () => {
    render(<App />)
    await enterPreview()
    fireEvent.click(screen.getByRole('button', { name: /open your invitation/i }))
    expect(screen.getByRole('heading', { name: /your wedding pass/i })).toBeTruthy()
    expect(screen.getByText(/Example family/i)).toBeTruthy()
    expect(screen.getByText(/This example contains no real guest data/i)).toBeTruthy()
  })

  it('saves an editable household RSVP', async () => {
    render(<App />)
    await enterPreview()
    fireEvent.click(screen.getAllByRole('button', { name: 'RSVP' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Coming' })[0])
    fireEvent.click(screen.getByRole('button', { name: /save my RSVP/i }))
    expect(screen.queryByText('Haldi')).toBeNull()
    expect(screen.queryByText('Mehndi')).toBeNull()
    expect(screen.getByText(/Sample RSVP saved only on this device/i)).toBeTruthy()
  })

  it('keeps the wedding manager hidden from sample guests', async () => {
    render(<App />)
    await enterPreview()
    expect(screen.queryByRole('button', { name: /wedding manager/i })).toBeNull()
  })

  it('opens a sample wedding story as a real viewer', async () => {
    render(<App />)
    await enterPreview()
    fireEvent.click(screen.getByRole('button', { name: /wedding desk/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/welcome to our private wedding home/i)).toBeTruthy()
  })

  it('keeps the concierge deterministic for unknown facts', async () => {
    render(<App />)
    await enterPreview()
    fireEvent.click(screen.getByRole('button', { name: /Need a hand/i }))
    const input = screen.getByPlaceholderText(/Ask a little something/i)
    fireEvent.change(input, { target: { value: 'What time is Sangeet?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText(/do not have a confirmed answer/i)).toBeTruthy()
  })

  it('never shows the sample identity to an authenticated guest', async () => {
    const user={id:'guest-a',displayName:'Asha Tyagi',role:'guest',side:'bride',relation:'Friend',invitedEvents:['event-wedding']}
    vi.stubGlobal('fetch',vi.fn(async(input:string|URL|Request)=>{
      const url=String(input)
      if(url.endsWith('/api/me'))return new Response(JSON.stringify({user}),{status:200})
      if(url.includes('social?action=profile'))return new Response('',{status:503})
      if(url.includes('/api/notifications'))return new Response(JSON.stringify({notifications:[]}),{status:200})
      return new Response(JSON.stringify({}),{status:404})
    }))
    render(<App />)
    fireEvent.click((await screen.findAllByRole('button',{name:'You'}))[0])
    expect(await screen.findByRole('heading',{name:'Asha Tyagi'})).toBeTruthy()
    await waitFor(()=>expect(screen.queryByText('Rohan Sharma')).toBeNull())
  })
})
