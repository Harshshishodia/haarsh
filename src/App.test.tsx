import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('V&D wedding concierge', () => {
  async function enterPreview() {
    fireEvent.click(await screen.findByRole('button', { name: /explore the sample/i }))
  }
  it('opens the private wedding pass from the guest home', async () => {
    render(<App />)
    await enterPreview()
    fireEvent.click(screen.getByRole('button', { name: /open your invitation/i }))
    expect(screen.getByRole('heading', { name: /your wedding pass/i })).toBeTruthy()
    expect(screen.getByText(/Sharma family/i)).toBeTruthy()
  })

  it('saves an editable household RSVP', async () => {
    render(<App />)
    await enterPreview()
    fireEvent.click(screen.getAllByRole('button', { name: 'RSVP' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Coming' })[0])
    fireEvent.click(screen.getByRole('button', { name: /save my RSVP/i }))
    expect(screen.getByText(/RSVP saved for your household/i)).toBeTruthy()
  })

  it('separates the wedding manager from the guest experience', async () => {
    render(<App />)
    await enterPreview()
    fireEvent.click(screen.getByRole('button', { name: /wedding manager/i }))
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy()
    expect(screen.getByText(/Good evening, Harsh/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Vendors/i })).toBeTruthy()
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
})
