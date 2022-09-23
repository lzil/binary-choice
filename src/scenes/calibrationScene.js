
import { randint, randchoice } from '../utils/rand'

const WHITE = 0xffffff
const CYAN = Phaser.Display.Color.GetColor(100, 150, 250)
const SALMON = Phaser.Display.Color.GetColor(250, 100, 100)

const CIRCLE_RADIUS = 50
const CALIBRATION_DELAY = 200
const CALIBRATION_SUCCESS_DELAY = 1500
const N_CIRCLES = 20


// calculate median
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
    this.load.image('mouse', 'assets/device_mouse.png')
    this.load.image('touchscreen', 'assets/device_touchscreen.png')
    this.load.image('trackpad', 'assets/device_trackpad.png')
    this.load.image('other', 'assets/device_other.png')
  }
  create() {
    let config = this.game.config
    let user_config = this.game.user_config
    // console.log(config.height, config.width)

    this.is_debug = user_config.is_debug
    let n_circles = N_CIRCLES
    if (this.is_debug) {
      n_circles = 3
      let med_time = 600
      this.scene.start('MainScene', med_time)
    }

    // this.game.canvas.style.cursor = 'pointer';

    this.hd2 = config.height/2
    this.wd2 = config.width/2
    this.cameras.main.setBounds(-this.wd2, -this.hd2, this.wd2*2, this.hd2*2)


    // fancy "CALIBRATION" title
    this.instructions_title_group = this.add.group()
    this.instructions_title_group.add(this.add.rectangle(-310, -480, 425, 80, SALMON, 0.9))
    this.instructions_title_group.add(this.add.rectangle(-300, -470, 425, 80, CYAN, 0.9))
    this.instructions_title_group.add(this.add.text(-500, -500, 'PRELIMINARIES', {
      fontFamily: 'Verdana',
      fontSize: 50,
      align: 'left'
    }))

    // welcome and instructions
    let instructions_font_params = {
      fontFamily: 'Verdana', 
      fontSize: 30,
      align: 'left'
    }

    this.instructions_txt = this.add.rexBBCodeText(-500, -380,
      "[b]Welcome to the task![/b] Please click on the device you're\ncompleting this task with today.",
      instructions_font_params)

    // secret finish button
    this.finish = this.add.rectangle(this.wd2,this.hd2,50,50).setInteractive().on('pointerdown',()=>{this.scene.start('MainScene', 600)})


    const mouse = this.add.image(-500, -100, 'mouse').setInteractive().setOrigin(0, 0.5).setScale(.2)
    mouse.on('pointerdown', () => {
      this.game.user_config.device = 'mouse'
      doCalibration()
    }).on('pointerover', () => this.game.canvas.style.cursor = 'pointer' )
      .on('pointerout', () => this.game.canvas.style.cursor = 'default' )
    const touchscreen = this.add.image(-500, 200, 'touchscreen').setInteractive().setOrigin(0, 0.5).setScale(.2)
    touchscreen.on('pointerdown', () => {
      this.game.user_config.device = 'touchscreen'
      doCalibration()
    }).on('pointerover', () => this.game.canvas.style.cursor = 'pointer' )
      .on('pointerout', () => this.game.canvas.style.cursor = 'default' )
    const other = this.add.image(500, 200, 'other').setInteractive().setOrigin(1, 0.5).setScale(.2)
    other.on('pointerdown', () => {
      this.game.user_config.device = 'other'
      doCalibration()
    }).on('pointerover', () => this.game.canvas.style.cursor = 'pointer' )
      .on('pointerout', () => this.game.canvas.style.cursor = 'default' )
    const trackpad = this.add.image(500, -100, 'trackpad').setInteractive().setOrigin(1, 0.5).setScale(.2)
    trackpad.on('pointerdown', () => {
      this.game.user_config.device = 'trackpad'
      doCalibration()
    }).on('pointerover', () => this.game.canvas.style.cursor = 'pointer' )
      .on('pointerout', () => this.game.canvas.style.cursor = 'default' )

    const doCalibration = () => {
      mouse.setVisible(false)
      touchscreen.setVisible(false)
      other.setVisible(false)
      trackpad.setVisible(false)

      // make first white circle visible
      this.circles[0].setVisible(true)
      this.times.push(this.game.loop.now)

      this.instructions_txt.setText("Now, let's get you calibrated. Circles will appear in different locations;\nmove your mouse to them as quickly as you can.")
    }

    

    this.calibration_success_txt = this.add.
      text(0, 0, 'Calibration successful!', {
        fontFamily: 'Verdana',
        fontSize: 50,
        align: 'center'
      }).
      setOrigin(0.5, 0.5).
      setVisible(false)


    // only 4 possible locations of circles
    let topleft = [-450, -200]
    let topright = [450, -200]
    let bottomleft = [-450, 400]
    let bottomright = [450, 400]
    this.locations = [topleft, topright, bottomleft, bottomright]

    // generate circles
    let prev_loc_ix
    let x, y
    let circle
    let loc_ix = 0
    this.circles_hit_idx = 0
    this.circles = []
    this.times = []
    for (let i = 0; i < n_circles; i++) {
      prev_loc_ix = loc_ix
      while (loc_ix === prev_loc_ix) {
        loc_ix = randint(0,3)
      }
      x = this.locations[loc_ix][0]
      y = this.locations[loc_ix][1]
      let circle = this.add.circle(x, y, CIRCLE_RADIUS, WHITE).setVisible(false)

      // once a circle is hit
      circle.setInteractive().on('pointerover', () => {
        // push the amount of time it took
        this.times.push(this.game.loop.now)
        this.circles[this.circles_hit_idx].setVisible(false)
        console.log('Hit circle', this.circles_hit_idx, 'at', this.game.loop.now)
        this.circles_hit_idx++
        if (this.circles_hit_idx >= this.circles.length) {
          // no more circles! move on to the real task
          this.calibration_success_txt.setVisible(true)
          let med_time = this.calibrate()
          console.log(med_time)
          this.game.user_config.med_time = med_time
          this.time.delayedCall(CALIBRATION_SUCCESS_DELAY, () => {
            this.scene.start('MainScene', med_time)
          })
        } else {
          // show the next circle only if there are more
          this.time.delayedCall(CALIBRATION_DELAY, () => {
            this.circles[this.circles_hit_idx].setVisible(true)
          })
        }
        
      })
      this.circles.push(circle)
    }

    
  }
  update() {

  }

  // calibration atm simply involves taking the median of the times
  calibrate() {
    this.timedifs = []
    for (let i = 1; i < this.times.length; i++) {
      this.timedifs.push(this.times[i+1] - this.times[i] - CALIBRATION_DELAY)
    }

    return median(this.timedifs)
  }
}
