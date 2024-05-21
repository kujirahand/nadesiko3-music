const PluginMusic = {
    'meta': {
        type: 'const',
        value: {
            pluginName: 'plugin_music', // プラグインの名前
            description: '音楽を再生するためのプラグイン', // 説明
            pluginVersion: '3.6.0', // プラグインのバージョン
            nakoRuntime: ['wnako'], // 対象ランタイム
            nakoVersion: '3.6.0' // 要求なでしこバージョン
        }
    },
    '初期化': {
        type: 'func',
        josi: [],
        fn: function (sys) {
        }
    },
    '!クリア': {
        type: 'func',
        josi: [],
        fn: function (sys) {
            // 演奏中であれば停める
            if (typeof (sys.__picoaudio) !== 'undefined') {
                sys.__picoaudio.initStatus()
            }
        }
    },
    // @音楽
    'MML演奏': { // @MMLを演奏する // @MMLえんそう
        type: 'func',
        josi: [['を', 'の']],
        fn: function (mml, sys) {
            if (typeof(sys.__sakuramml) === 'undefined') {
                // プレイヤーの読み込み
                loadScript('https://cdn.jsdelivr.net/npm/picoaudio@1.1.2/dist/browser/PicoAudio.min.js', () => {
                    sys.__picoaudio = new PicoAudio()
                    console.log('loaded PicoAudio.min.js')
                });
                // コンパイラの読み込み
                import('https://cdn.jsdelivr.net/npm/sakuramml@0.1.25/sakuramml.js')
                .then(module => {
                    sys.__sakuramml = module;
                    module.default().then(() => {
                        console.log('loaded sakuramml.js')
                        console.log('sakuramml ver.', module.get_version());
                        playMML(mml, sys)
                    })
                });
            } else {
                playMML(mml, sys)
            }
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
            // プレイヤーの読み込み
            if (typeof(sys.__picoaudio) === 'undefined') {
                loadScript('https://cdn.jsdelivr.net/npm/picoaudio@1.1.2/dist/browser/PicoAudio.min.js', () => {
                    sys.__picoaudio = new PicoAudio()
                    console.log('loaded PicoAudio.min.js')
                    playMIDI(url, sys)
                });
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
}

function playMML(mml, sys) {
    // wait for picoaudio
    if (typeof(sys.__picoaudio) === 'undefined') {
        setTimeout(() => { playMML(mml, sys) }, 100)
        return
    }
    // play
    const SakuraCompiler = sys.__sakuramml.SakuraCompiler
    const com = SakuraCompiler.new()
    com.set_language('ja')
    const binMidi = com.compile(mml)
    const log = com.get_log()
    const smfData = new Uint8Array(binMidi);
    console.log('sakuramml.log=', log)
    // console.log('@', sys.__picoaudio)
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

// module.exports = PluginMusic
// export default PluginMusic

// scriptタグで取り込んだ時、自動で登録する
/* istanbul ignore else */
if (typeof (navigator) === 'object' && typeof (navigator.nako3)) {
    navigator.nako3.addPluginObject('PluginMusic', PluginMusic) 
}

