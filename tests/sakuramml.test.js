import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import init, { SakuraCompiler, get_version } from 'sakuramml'

const sakuraMmlPath = fileURLToPath(import.meta.resolve('sakuramml'))
const sakuraMmlDir = dirname(sakuraMmlPath)
await init({ module_or_path: await readFile(join(sakuraMmlDir, 'sakuramml_bg.wasm')) })

function compileMml (source) {
    const compiler = SakuraCompiler.new()
    compiler.set_language('ja')
    const midi = compiler.compile(source)
    const result = {
        log: compiler.get_log(),
        noteNumbers: [...compiler.dump_midi(midi).matchAll(/NoteOn\(\$([0-9a-f]{2}),/gi)].map(match => Number.parseInt(match[1], 16))
    }
    compiler.free()
    return result
}

function compileMidi (source) {
    const compiler = SakuraCompiler.new()
    compiler.set_language('ja')
    const midi = compiler.compile(source)
    const result = {
        log: compiler.get_log(),
        bytes: [...midi]
    }
    compiler.free()
    return result
}

test('plugin and test dependency use sakuramml 0.2.3', async () => {
    const pluginSource = await readFile(new URL('../nadesiko3-music.js', import.meta.url), 'utf8')

    assert.equal(get_version(), '0.2.3')
    assert.match(pluginSource, /const SAKURAMML_VER = '0\.2\.3'/)
})

test('n() resolves literals, variables, and Random() results to audible note numbers', () => {
    const cases = [
        ['literal', 'TR(1) [12 n(60)]', noteNumber => noteNumber === 60],
        ['variable', 'Int I=60\nTR(1) [12 n(I)]', noteNumber => noteNumber === 60],
        ['Random()', 'TR(1) [12 n(Random(60,72))]', noteNumber => noteNumber >= 60 && noteNumber <= 72]
    ]

    for (const [name, source, isExpectedNote] of cases) {
        const result = compileMml(source)
        assert.equal(result.log, '', `${name}: compiler log`)
        assert.equal(result.noteNumbers.length, 12, `${name}: note count`)
        assert.ok(result.noteNumbers.every(isExpectedNote), `${name}: ${result.noteNumbers.join(', ')}`)
    }
})

test('a simple MML score produces the expected Standard MIDI File bytes', () => {
    const result = compileMidi('TR(1) [1 n(60)]')

    assert.equal(result.log, '')
    assert.deepEqual(result.bytes, [
        // MThd: format 1, two tracks, timebase 96
        0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x02, 0x00, 0x60,
        // Track 0: end of track
        0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x04, 0x00, 0xff, 0x2f, 0x00,
        // Track 1: note 60 on, note 60 off after 86 ticks, end of track
        0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x90, 0x3c, 0x64,
        0x56, 0x80, 0x3c, 0x64, 0x00, 0xff, 0x2f, 0x00
    ])
})
