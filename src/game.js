import Phaser from 'phaser'
import UAParser from 'ua-parser-js'

import CalibrationScene from './scenes/calibrationScene'
import MainScene from './scenes/mainScene'
import EndScene from './scenes/endScene'

// import 'devtools-detect'

import BBCodeTextPlugin from 'phaser3-rex-plugins/plugins/bbcodetext-plugin.js'

// let height = window.screen.height
// let width = height * 1.5

let height = 1200
let width = 1800

const phaser_config = {
  type: Phaser.AUTO,
  backgroundColor: '#000000',
  scale: {
    parent: 'phaser-game',
    mode: Phaser.Scale.FIT,
    // autoCenter: Phaser.Scale.CENTER_BOTH,
    width: width,
    height: height
  },
  audio: {
    noAudio: true
  },
  scene: [CalibrationScene, MainScene, EndScene],
  plugins: {
    global: [
      {
        key: 'rexBBCodeTextPlugin',
        plugin: BBCodeTextPlugin,
        start: true
      }
    ]
  }
}

window.addEventListener('load', () => {
  const game = new Phaser.Game(phaser_config)
  // TODO: figure out prolific/mturk/elsewhere here (URL parsing)
  // Remember that localStorage *only stores strings*
  const url_params = new URL(window.location.href).searchParams
  // If coming from prolific, use that ID. Otherwise, generate some random chars
  const randomString = (length) =>
    [...Array(length)].
      map(() => (~~(Math.random() * 36)).toString(36)).
      join('')
  let id =
    url_params.get('SONA_ID') ||
    url_params.get('PROLIFIC_PID') ||
    url_params.get('id') ||
    randomString(8)
  let ua_res = new UAParser().getResult()
  let user_config = {
    id: id.slice(0, 8), // just the first part of the ID, we don't need to store the whole thing
    is_prolific: url_params.get('PROLIFIC_PID') !== null,
    is_sona: url_params.get('SONA_ID') !== null,
    institution: 'yale',
    description: 'binary choice v1',
    datetime: new Date(),
    already_visited: localStorage.getItem('binary-choice') !== null,
    width: game.config.width,
    height: game.config.height,
    renderer: game.config.renderType === Phaser.CANVAS ? 'canvas' : 'webgl',
    // only take a subset of the UA results-- we don't need everything
    user_agent: {
      browser: ua_res.browser,
      os: ua_res.os
    },
    is_debug: url_params.get('debug') !== null,
    version: 1,
  }
  user_config.device = 'none'
  user_config.is_debug = true
  user_config.is_debug = false

  console.log(user_config)

  game.user_config = user_config // patch in to pass into game
  localStorage.setItem('binary-choice', 1)

})



// once the data is successfully sent, null this out
// need to log this too
export function onBeforeUnload(event) {
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
  event.preventDefault()
  event.returnValue = ''
  return 'experiment not done yet.'
}
!DEBUG && window.addEventListener('beforeunload', onBeforeUnload)
