
import { randint, randchoice } from '../utils/rand'

const WHITE = 0xffffff
const CYAN = Phaser.Display.Color.GetColor(100, 150, 250)
const SALMON = Phaser.Display.Color.GetColor(250, 100, 100)

const CIRCLE_RADIUS = 50
const CALIBRATION_DELAY = 200
const CALIBRATION_SUCCESS_DELAY = 1500
const N_CIRCLES = 2

function median(values){
  if(values.length ===0) throw new Error("No inputs");

  values.sort(function(a,b){
    return a-b;
  });

  var half = Math.floor(values.length / 2);
  
  if (values.length % 2)
    return values[half];
  
  return (values[half - 1] + values[half]) / 2.0;
}



export default class CalibrationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CalibrationScene' })

  }
  preload() {
    // load feedback images (check? x? sparks?)
  }
  create() {
    let config = this.game.config
    let user_config = this.game.user_config

    this.hd2 = config.height/2
    this.wd2 = config.width/2
    this.cameras.main.setBounds(-this.wd2, -this.hd2, this.wd2*2, this.hd2*2)


    // fancy "CALIBRATION" title
    this.instructions_title_group = this.add.group()
    this.instructions_title_group.add(this.add.rectangle(-310, -480, 425, 80, SALMON, 0.9))
    this.instructions_title_group.add(this.add.rectangle(-300, -470, 425, 80, CYAN, 0.9))
    this.instructions_title_group.add(this.add.text(-500, -500, 'CALIBRATION', {
      fontFamily: 'Verdana',
      fontSize: 50,
      align: 'left'
    }))

    let instructions_font_params = {
      fontFamily: 'Verdana', 
      fontSize: 30,
      align: 'left'
    }
    this.instructions_group = this.add.group()
    this.instructions_group.add(this.add.text(-500, -350,
      "First, let's get you calibrated. Circles will appear in different locations;\nmove your mouse to them as quickly as you can.",
      instructions_font_params))

    this.calibration_success_txt = this.add.
      text(0, 0, 'Calibration successful!', {
        fontFamily: 'Verdana',
        fontSize: 50,
        align: 'center'
      }).
      setOrigin(0.5, 0.5).
      setVisible(false)


    let topleft = [-450, -200]
    let topright = [450, -200]
    let bottomleft = [-450, 400]
    let bottomright = [450, 400]

    this.locations = [topleft, topright, bottomleft, bottomright]
    // generate circles
    // let xmin = -450
    // let xmax = 450
    // let ymin = -200
    // let ymax = 400
    
    // let x = -5000
    // let y = -5000
    // let prev_x, prev_y
    let prev_loc_ix
    let loc_ix = 0
    let x, y
    this.circles = []
    this.times = []
    let circle
    this.circles_hit_idx = 0
    for (let i = 0; i < N_CIRCLES; i++) {
      prev_loc_ix = loc_ix
      while (loc_ix === prev_loc_ix) {
        loc_ix = randint(0,3)
      }
      x = this.locations[loc_ix][0]
      y = this.locations[loc_ix][1]
      let circle = this.add.circle(x, y, CIRCLE_RADIUS, WHITE).setVisible(false)
      console.log(x, y)

      circle.setInteractive().on('pointerover', () => {
        this.times.push(this.game.loop.now)
        this.circles[this.circles_hit_idx].setVisible(false)
        console.log('Hit circle', this.circles_hit_idx, 'at', this.game.loop.now)
        this.circles_hit_idx++
        if (this.circles_hit_idx >= this.circles.length) {
          this.calibration_success_txt.setVisible(true)
          // TODO: calculate calibration
          this.calibrate()
          this.time.delayedCall(CALIBRATION_SUCCESS_DELAY, () => {
            this.scene.start('MainScene', this.med_time)
          })
        } else {
          this.time.delayedCall(CALIBRATION_DELAY, () => {
            this.circles[this.circles_hit_idx].setVisible(true)
          })
        }
        
      })
      this.circles.push(circle)
    }

    this.circles[0].setVisible(true)
    this.times.push(this.game.loop.now)
    
  }
  update() {

  }

  calibrate() {
    this.timedifs = []
    for (let i = 1; i < this.times.length; i++) {
      this.timedifs.push(this.times[i+1] - this.times[i])
    }

    // console.log(this.timedifs, this.timedifs.length)

    this.med_time = median(this.timedifs)
    console.log(this.med_time)

  }
}
