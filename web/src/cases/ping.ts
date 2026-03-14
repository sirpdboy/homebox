// web/src/cases/ping.ts
const API_BASE_URL = ''; 
import { BASE_URL } from '../const'

export const ping = async () => {
  const now = performance.now()
  try {
    const resp = await fetch(`${API_BASE_URL}/ping`, { 
      method: 'HEAD' 
    })
    await resp.text()
    const time = performance.now() - now
    return time
  } catch (err) {
    console.error('Ping failed:', err)
    throw err
  }
}
