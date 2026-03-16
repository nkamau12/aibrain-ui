/**
 * Base fetch wrapper for all API calls.
 *
 * Responsibilities:
 * - Attach Content-Type header for POST requests
 * - Translate non-OK HTTP responses into thrown errors with the server's
 *   own error message when available
 * - Translate network-level TypeErrors (offline, DNS failure, etc.) into a
 *   human-readable message rather than exposing the raw browser error
 */
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const isPost = options?.method?.toUpperCase() === 'POST'

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...(isPost ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  }

  let response: Response

  try {
    response = await fetch(url, mergedOptions)
  } catch (error) {
    // TypeError is thrown for network failures (offline, invalid URL scheme, CORS
    // preflight abort, etc.). Any other thrown value is unexpected — re-throw.
    if (error instanceof TypeError) {
      throw new Error('Unable to connect to server')
    }
    throw error
  }

  if (!response.ok) {
    // Attempt to read the server's error message from the response body.
    // The server is expected to return { error: string } for all error responses,
    // but we fall back gracefully if the body is not JSON or uses a different shape.
    let serverMessage: string | undefined
    try {
      const body = await response.json()
      serverMessage = typeof body?.error === 'string' ? body.error : undefined
    } catch {
      // Body is not JSON — ignore and fall through to the generic message
    }

    throw new Error(serverMessage ?? `Request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}
