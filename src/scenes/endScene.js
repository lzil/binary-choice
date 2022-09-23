// all done, send the data
import postData from '../utils/postdata'
import { onBeforeUnload } from '../game'

import { saveAs } from 'file-saver';

const WHITE = 0xffffff
const GREEN = 0x39ff14 // actually move to the target
const RED = 0xff0000
const BRIGHTRED = Phaser.Display.Color.GetColor(175, 50, 50)
const DARKGRAY = 0x444444
const GRAY = Phaser.Display.Color.GetColor(100, 100, 100)
const LIGHTGRAY = Phaser.Display.Color.GetColor(150, 150, 150)
const CYAN = Phaser.Display.Color.GetColor(100, 150, 250)
const SALMON = Phaser.Display.Color.GetColor(250, 100, 100)

export default class EndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndScene' })
  }
  create(all_data) {

    this.hd2 = this.game.config.height/2
    this.wd2 = this.game.config.width/2
    this.cameras.main.setBounds(-this.wd2, -this.hd2, this.wd2*2, this.hd2*2)
    
    let user_config = this.game.user_config
    let is_sona = this.game.user_config.is_sona


    // finish text and button
    this.add.text(0,-100,"Click the button below to finish.", {
      fontFamily: 'Verdana',
      fontSize: 40,
      align: 'center'
    }).setOrigin(0.5, 0.5)
    this.add.image(0, 50, 'finish').setRotation(Phaser.Math.DegToRad(45)).setScale(.2)
      .setInteractive()
      .on('pointerover', () => this.game.canvas.style.cursor = 'pointer' )
      .on('pointerout', () => this.game.canvas.style.cursor = 'default' )
      .once('pointerdown', postSelection)
    this.add.text(0,50,"Finish!",{fontSize:45, color:DARKGRAY}).setOrigin(0.5,0.5)

    // most of the URL
    let mostly = 'https://google.com/?cc='
    if (this.game.user_config.is_prolific) {
      mostly = 'https://app.prolific.co/submissions/complete?cc='
    } else if (is_sona) {
      mostly = `https://yale.sona-systems.com/webstudy_credit.aspx?experiment_id=1479&credit_token=762ab607160043e58dd4ba6e9e1b288d&survey_code=${id}`
    }

    function postSelection(scene) {
      let alldata = { config: user_config, data: all_data }

      let is_sona = false
      let is_prolific = false

      if (user_config.is_debug) {
        let file = new Blob([JSON.stringify(all_data, undefined, 2)], {type: 'application/json'});
        saveAs(file, 'all_data.json');
      } else if (!is_sona) {
        // is not sona
        // so possibly prolific
        // or if anything else, google redirect
        window.removeEventListener('beforeunload', onBeforeUnload)
        Promise.all(postData(alldata)).then((values) => {
          window.location.href = mostly + '8E059F9A'
        })
      } else {
        // is sona
        // allow option to download the debrief

        //code not yet configured for sona
        scene.add.
          text(center, center - 100, 'Click here to download\nthe debriefing.', {
            fontFamily: 'Verdana',
            fontStyle: 'bold',
            fontSize: 40,
            color: '#dddddd',
            stroke: '#444444',
            strokeThickness: 4,
            align: 'center'
          }).
          setOrigin(0.5, 0.5).
          setInteractive().
          on('pointerdown', () => {
            let anchor = document.createElement('a')
            anchor.href = './assets/actlab_debrief.pdf'
            anchor.target = '_blank'
            anchor.download = 'actlab_debrief.pdf'
            anchor.click()
          })

        let credit_txt = scene.add.
          text(center, center + 100, 'Click here to get SONA credit.\n(Will take a moment to redirect)', {
            fontFamily: 'Verdana',
            fontStyle: 'bold',
            fontSize: 40,
            color: '#00ff00',
            stroke: '#444444',
            strokeThickness: 4,
            align: 'center'
          }).
          setOrigin(0.5, 0.5).
          setInteractive().
          once('pointerdown', () => {
            credit_txt.text = 'Redirecting now...'
            window.removeEventListener('beforeunload', onBeforeUnload)
            Promise.all(postData(alldata)).then((values) => {
              window.location.href = mostly
            })
          })
      }
    }

  }
}
