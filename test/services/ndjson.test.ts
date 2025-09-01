import { describe, it, expect } from 'vitest'
import { iterNdjson } from '@/services/ndjson'

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

describe('iterNdjson', () => {
  it('yields parsed objects per line and ignores blanks/malformed', async () => {
    const stream = makeStream([
      '{"a":1}\n',
      '\n',
      'not json\n',
      '{"b":2}\n{"c":3}',
    ])
    const out: any[] = []
    for await (const obj of iterNdjson(stream)) out.push(obj)
    expect(out).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })
})

