/** Pages adapter for the existing registry-only News gateway; no ingestion or client changes. */
import { collectFeeds, FEED_CACHE_CONTROL } from '../../src/current-affairs/gateway.ts'

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
  if (request.method !== 'GET') {
    headers.set('Allow', 'GET')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }
  // Workers rejects redirect: 'error'; manual keeps the gateway's existing !ok rejection of all 3xx responses.
  const data = await collectFeeds((input, init) => fetch(input, { ...init, redirect: 'manual' }))
  const available = data.sources.some(source => source.status !== 'failed')
  headers.set('Cache-Control', available ? FEED_CACHE_CONTROL : 'no-store')
  return new Response(JSON.stringify(available ? data : { error: 'All publishers are unavailable', sources: data.sources }), { status: available ? 200 : 503, headers })
}
