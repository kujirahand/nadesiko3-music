// nadesiko3-music.js
const SAKURAMML_VER = '0.2.3' // sakurammlのバージョン
const SAKURAMML_URL = `https://cdn.jsdelivr.net/npm/sakuramml@${SAKURAMML_VER}/sakuramml.js`
const PICOAUDIO_VER = '1.1.2' // picoaudioのバージョン
const PICOAUDIO_URL = `https://cdn.jsdelivr.net/npm/picoaudio@${PICOAUDIO_VER}/dist/browser/PicoAudio.min.js`
const LIBFLUIDSYNTH_VER = '2.4.6' // libfluidsynthのバージョン
const LIBFLUIDSYNTH_URL = `https://nadesi.com/v3/common/music/libfluidsynth-${LIBFLUIDSYNTH_VER}-with-libsndfile.js`
const JS_SYNTH_VER = '1.11.0' // js-synthesizerのバージョン
const JS_SYNTH_URL = `https://nadesi.com/v3/common/music/js-synthesizer@${JS_SYNTH_VER}.min.js`
const DEFAULT_SOUNDFONT_URL = 'https://nadesi.com/v3/common/music/TimGM6mb.sf2'

const PluginMusic = {
    'meta': {
        type: 'const',
        value: {
            pluginName: 'plugin_music', // プラグインの名前
            description: '音楽を再生するためのプラグイン', // 説明
            pluginVersion: '3.8.0', // プラグインのバージョン
            nakoRuntime: ['wnako'], // 対象ランタイム
            nakoVersion: '3.6.6' // 要求なでしこバージョン
        }
    },
    '初期化': {
        type: 'func',
        josi: [],
        fn: function (sys) {
            sys.__picoaudio = undefined
            sys.__picoaudio_promise = undefined
            sys.__sakuramml = undefined
            sys.__sakuramml_promise = undefined
            sys.__soundfont = undefined
            sys.__jssynth = undefined
            sys.__audio_context = undefined
            sys.__picoaudio_loop = false
            sys.__soundfont_wait_time = 300 // サウンドフォント読み込み後の待機時間(ミリ秒)
        }
    },
    '!クリア': {
        type: 'func',
        josi: [],
        fn: async function (sys) {
            // 演奏中であれば停める
            if (typeof (sys.__picoaudio) !== 'undefined') {
                sys.__picoaudio.initStatus()
            }
            // サウンドフォントの演奏を停止
            await stopSoundFontMIDIAsync(sys)
        }
    },
    // @音楽
    'MML演奏': { // @MMLを演奏する // @MMLえんそう
        type: 'func',
        josi: [['を', 'の']],
        fn: function (mml, sys) {
            // コンパイラ・プレイヤーの読み込み
            loadPicoAudioAsync(sys).catch(err => console.error(err.message))
            loadSakuraMMLAsync(sys).then(module => {
                playMML(mml, module, sys)
            }).catch(err => console.error('MML演奏の準備に失敗しました:', err))
        },
        return_none: true
    },
    'MML停止': { // @MML演奏で開始した演奏を停止する // @MMLていし
        type: 'func',
        josi: [],
        fn: function (sys) {
            if (typeof (sys.__picoaudio) === 'undefined') {
                return
            }
            sys.__picoaudio.initStatus()
        }
    },
    'MIDI演奏': { // @MIDIファイルのあるURLを指定して演奏する // @MIDIえんそう
        type: 'func',
        josi: [['を', 'の']],
        asyncFn: true,
        fn: async function (url, sys) {
            // プレイヤーの読み込み(多重読み込み・二重再生を避けるためPromiseを使う)
            const pico = await loadPicoAudioAsync(sys).catch(err => {
                console.error(err.message)
                return undefined
            })
            if (typeof (pico) === 'undefined') {
                return
            }
            playMIDI(url, sys)
        },
        return_none: true
    },
    'MIDI停止': { // @MIDI演奏で開始した演奏を停止する // @MIDIていし
        type: 'func',
        josi: [],
        fn: function (sys) {
            if (typeof (sys.__picoaudio) === 'undefined') {
                return
            }
            sys.__picoaudio.initStatus()
        }
    },
    'MIDIループ再生設定': { // @V(オン|オフ)にMML演奏/MIDI演奏で再生をループするように指定 // @MIDIるーぷさいせいせってい
        type: 'func',
        josi: [['に', 'へ']],
        fn: function (v, sys) {
            sys.__picoaudio_loop = v
        }
    },
    'MMLコンパイル': { // @MMLをコンパイルしてMIDIファイルに変換する // @MMLこんぱいる
        type: 'func',
        josi: [['を', 'の']],
        asyncFn: true,
        fn: async function (mml, sys) {
            return await compileMMLAsync(mml, sys)
        }
    },
    // @サウンドフォント
    'サウンドフォント読': { // @サウンドフォントのURLを指定して読み込む。URLに「デフォルト」を指定可能 // @さうんどふぉんとよむ
        type: 'func',
        josi: [['から', 'の']],
        asyncFn: true,
        fn: async function (url, sys) {
            return await loadSoundFontAsync(url, sys)
        }
    },
    'サウンドフォントMIDI演奏': { // @MIDIデータ(バイナリ)を指定して演奏する // @さうんどふぉんとMIDIえんそう
        type: 'func',
        josi: [['を', 'の']],
        asyncFn: true,
        fn: async function (bin, sys) {
            if (typeof(sys.__soundfont) === 'undefined') {
                await loadSoundFontAsync(DEFAULT_SOUNDFONT_URL, sys)
            }
            // SoundFontを使ってMIDIを演奏する
            await playMIDIWithSoundFont(bin , sys.__soundfont, sys)
        }
    },
    'サウンドフォントMIDI演奏停止': { // @再生中のMIDI演奏を停止する // @さうんどふぉんとえんそうていし
        type: 'func',
        josi: [],
        asyncFn: true,
        fn: async function (sys) {
            await stopSoundFontMIDIAsync(sys)
        }
    },
    'サウンドフォントMML演奏': { // @MMLをサウンドフォントで演奏する // @さうんどふぉんとMMLえんそう
        type: 'func',
        josi: [['を', 'の']],
        asyncFn: true,
        fn: async function (mml, sys) {
            if (typeof(sys.__soundfont) === 'undefined') {
                await loadSoundFontAsync(DEFAULT_SOUNDFONT_URL, sys)                
            }
            // MIDIをバイナリに変換
            const bin = await compileMMLAsync(mml, sys)
            // SoundFontを使ってMIDIを演奏する
            await playMIDIWithSoundFont(bin , sys.__soundfont, sys)
        }
    },
    'サウンドフォント待時間設定': { // @再生前の待機時間をミリ秒で指定(エラーが出るときに指定) // @さうんどふぉんとまちじかんせってい
        type: 'func',
        josi: [["に", "へ"]],
        asyncFn: true,
        fn: async function (v, sys) {
            sys.__soundfont_wait_time = v
        }
    },
}

/// サウンドフォントの演奏を停止する
async function stopSoundFontMIDIAsync(sys) {
    // 演奏中でなければ何もしない
    if (typeof (sys.__jssynth) === 'undefined') {
        return
    }
    try {
        try {
            // 停止
            await sys.__jssynth.stopPlayer()
        } catch (e) {
            console.error('JSSynth stopPlayer error:', e)
        }
        // AudioContextを閉じる
        if (typeof(sys.__audio_context) !== 'undefined') {
            await sys.__audio_context.close()
            sys.__audio_context = undefined
        }
        // Synthesizerを破棄
        sys.__jssynth = undefined
        sys.__soundfont = undefined
    } catch (e) {
        console.error('AudioContext close error:', e)
    }
}

/// サウンドフォントのバイナリデータを読み込む
async function loadSoundFontAsync(url, sys) {   
    if (url === 'デフォルト') {
        url = DEFAULT_SOUNDFONT_URL
    }
    console.log('load SoundFont file=', url)
    try {
        const response = await fetch(url)
        if (!response.ok) {
            console.error('サウンドフォントの読み込みでURLのエラー : fetch error', response)
            return
        }
        const buffer = await response.arrayBuffer()
        const sfData = new Uint8Array(buffer)
        sys.__soundfont = sfData
        console.log('loaded SoundFont file, size=', sfData.length)
        return sfData
    } catch (error) {
        console.error('サウンドフォントの読み込みでURLのエラー : ', error)
        sys.__soundfont = undefined
        throw error
    }
}

/// SoundFontを使ってMIDIを演奏する
async function playMIDIWithSoundFont(binMidi, soundfont, sys) {
    // ライブラリの読み込み
    await loadScriptAsync(LIBFLUIDSYNTH_URL)
    await loadScriptAsync(JS_SYNTH_URL)
    await sleep(sys.__soundfont_wait_time)

    // オーディオコンテキストの初期化
    const context = new AudioContext()
    const synth = new JSSynth.Synthesizer()
    synth.init(context.sampleRate)

    // Create AudioNode (ScriptProcessorNode) to output audio data
    const node = synth.createAudioNode(context, 8192) // 8192 is the frame count of buffer
    node.connect(context.destination)

    await synth.loadSFont(soundfont)
    await synth.addSMFDataToPlayer(binMidi)

    // ループ再生設定
    if (sys.__picoaudio_loop) {
        try {
            synth.setPlayerLoop(-1)
            console.log('SoundFont MIDI loop enabled')
        } catch (e) {
            console.error('SoundFont MIDI loop error:', e)
        }
    } else {
        // synth.setPlayerLoop(1)
    }

    // 演奏開始
    await synth.playPlayer()


    sys.__audio_context = context
    return sys.__jssynth = synth
}

/// スリープ
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/// sakuramml(WASM)を読み込む。多重に呼ばれても初期化は一度だけ行う
function loadSakuraMMLAsync (sys) {
    if (typeof(sys.__sakuramml_promise) === 'undefined') {
        sys.__sakuramml_promise = import(SAKURAMML_URL)
            .then(async module => {
                await module.default()
                sys.__sakuramml = module
                console.log('loaded sakuramml.js ver.', module.get_version())
                return module
            })
            .catch(err => {
                // 失敗時は次回に備えて読み込み前の状態に戻す
                sys.__sakuramml_promise = undefined
                throw err
            })
    }
    return sys.__sakuramml_promise
}

/// PicoAudio(演奏エンジン)を読み込む。多重に呼ばれても初期化は一度だけ行う
function loadPicoAudioAsync (sys) {
    if (typeof(sys.__picoaudio_promise) === 'undefined') {
        sys.__picoaudio_promise = new Promise((resolve, reject) => {
            loadScript(PICOAUDIO_URL, () => {
                const PicoAudio = window.PicoAudio
                if (typeof(PicoAudio) === 'undefined') {
                    reject(new Error('PicoAudio.min.jsの読み込みに失敗しました'))
                    return
                }
                const pico = new PicoAudio()
                sys.__picoaudio = pico
                console.log('loaded PicoAudio.min.js')
                resolve(pico)
            })
        })
        sys.__picoaudio_promise.catch(() => {
            // 失敗時は次回に備えて読み込み前の状態に戻す
            sys.__picoaudio_promise = undefined
        })
    }
    return sys.__picoaudio_promise
}

/// MMLをコンパイルしてMIDIバイナリを返す(非同期版)
async function compileMMLAsync (mml, sys) {
    const module = await loadSakuraMMLAsync(sys)
    return compileMML(mml, module)
}

/// MMLをコンパイルしてMIDIバイナリを返す
function compileMML (mml, module) {
    const SakuraCompiler = module.SakuraCompiler
    const com = SakuraCompiler.new()
    com.set_language('ja')
    const binMidi = com.compile(mml)
    reportMmlLog(com.get_log())
    return binMidi
}

/// コンパイルログを出力する。エラーは「音が出ないのに気づかない」を防ぐためconsole.errorに出す
function reportMmlLog (log) {
    if (typeof (log) !== 'string' || log === '') {
        return
    }
    if (log.indexOf('[ERROR]') >= 0) {
        console.error('MMLのコンパイルに失敗しました:\n' + log)
    } else {
        console.log('sakuramml.log=', log)
    }
}

/// MMLを演奏する(PicoAudioを使う)
async function playMML (mml, module, sys) {
    if (typeof (module) === 'undefined') {
        return
    }
    // PicoAudioの読み込み完了を待つ(失敗時は何もしない)
    const pico = await loadPicoAudioAsync(sys).catch(err => {
        console.error(err.message)
        return undefined
    })
    if (typeof (pico) === 'undefined') {
        return
    }
    // play
    const binMidi = compileMML(mml, module)
    if (typeof (binMidi) === 'undefined') {
        return
    }
    const smfData = new Uint8Array(binMidi);
    pico.initStatus()
    const parsedData = pico.parseSMF(smfData)
    pico.setData(parsedData)
    pico.init()
    // ループ再生設定
    if (sys.__picoaudio_loop) {
        pico.setLoop(true)
    } else {
        pico.setLoop(false)
    }
    pico.play()
}

function playMIDI(url, sys) {
    // wait for picoaudio
    if (typeof (sys.__picoaudio) === 'undefined') {
        setTimeout(() => { playMIDI(url, sys) }, 100)
        return
    }
    // fetch midi
    console.log('load MIDI file=')
    fetch(url)
    .then(response => {
        if (!response.ok) {
            console.error('MIDI演奏でURLのエラー : fetch error', response)
            return
        }
        return response.arrayBuffer()
    })
    .then(buffer => {
        const smfData = new Uint8Array(buffer)
        // console.log('smfData=', smfData)
        sys.__picoaudio.initStatus()
        const parsedData = sys.__picoaudio.parseSMF(smfData)
        sys.__picoaudio.setData(parsedData)
        sys.__picoaudio.init()
        // ループ再生設定
        if (sys.__picoaudio_loop) {
            sys.__picoaudio.setLoop(true)
        } else {
            sys.__picoaudio.setLoop(false)
        }
        sys.__picoaudio.play()
    })
    .catch(error => {
        console.error('MIDI演奏でURLのエラー : ', error)
    })
}

/// 非同期でスクリプトを読み込む
async function loadScriptAsync(url) {
    return new Promise((resolve, _reject) => {
        loadScript(url, () => {
            resolve()
        })
    })
}


function loadScript(url, callback) {
    // 新しいscript要素を作成
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    // スクリプトの読み込みが完了した際のコールバックを設定
    if (callback) {
        script.onload = callback;
    }

    // script要素をドキュメントに追加
    document.head.appendChild(script);
}

// scriptタグで取り込んだ時、自動で登録する
/* istanbul ignore else */
if (typeof (navigator) === 'object' && typeof (navigator.nako3) === 'object') {
    console.log('nadesiko3-music.js loaded.')
    navigator.nako3.addPluginObject('PluginMusic', PluginMusic)
}
// module.exports = PluginMusic
// export default PluginMusic
