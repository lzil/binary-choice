import { TypingText } from '../objects/typingtext'
import { Enum } from '../utils/enum'
// import BasicExample from '../objects/examples'
// import merge_data from '../utils/merge'
import { clamp } from '../utils/clamp'
import { randint, randchoice } from '../utils/rand'
// import signedAngleDeg from '../utils/angulardist'
// import { mad, median } from '../utils/medians'
import generateTrials from '../utils/trialgen'
// import make_thick_arc from '../utils/arc'
// import { Staircase } from '../utils/staircase'

const WHITE = 0xffffff
const GREEN = 0x39ff14 // actually move to the target
const RED = 0xff0000
const BRIGHTRED = Phaser.Display.Color.GetColor(175, 50, 50)
const DARKGRAY = 0x444444
const GRAY = Phaser.Display.Color.GetColor(100, 100, 100)
const LIGHTGRAY = Phaser.Display.Color.GetColor(150, 150, 150)
const CYAN = Phaser.Display.Color.GetColor(100, 150, 250)
const SALMON = Phaser.Display.Color.GetColor(250, 100, 100)

const TARGET_SIZE_RADIUS = 40
// const CURSOR_SIZE_RADIUS = 5
const CENTER_SIZE_RADIUS = 15
const MOVE_THRESHOLD = 4

const TARGET_DISTANCE = 800 // *hopefully* they have 300px available?
const TARGET_REF_ANGLE = 270 // degrees, and should be pointed straight up
const TARGET_DIF = 30

const CURSOR_START_Y = 400

// const CURSOR_RESTORE_POINT = 200 //
// const CURSOR_RESTORE_X = 0 //
// const CURSOR_RESTORE_Y = 200 //
// const MOVE_SCALE = 0.75 // factor to combat pointer acceleration
const PI = Math.PI
// const MAX_STAIRCASE = 10
// generate the noise texture (512x512 so we're pretty sure it'll fit any screen, esp once
// it gets scaled up to 3x3 pixel blocks)
// const NOISE_DIM = 512
// let noise_tex = []
// let tmp = ['0', '2'] // 0 = black, 2 = white for the arne16 palette
// for (let i = 0; i < NOISE_DIM; i++) {
//   noise_tex[i] = ''
//   for (let j = 0; j < NOISE_DIM; j++) {
//     noise_tex[i] += tmp[Math.floor(2 * Math.random())] // randomChoice
//   }
// }

// fill txts later-- we need to plug in instructions based on their runtime mouse choice
let instruct_txts = {}

const states = Enum([
  'INSTRUCT', // show text instructions (based on stage of task)
  'PRETRIAL', // wait until ready to start trial
  'MOVING', // the movement part
  // 'QUESTIONS', // which side did cursor go to?
  'POSTTRIAL', // auto teleport back to restore point
  'END' //
])

// const Err = {
//   reached_away: 1,
//   late_start: 2,
//   slow_reach: 4,
//   wiggly_reach: 8,
//   returned_to_center: 16
// }

function countTrials(array) {
  return array.filter((v) => !v['type'].startsWith('instruct_')).length
}

function dist(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' })
    this._state = states.INSTRUCT
    // this._state = states.PRETRIAL
    this.entering = true
    // these line up with trial_type
    this.all_data = {
      // practice_basic: [], // practice reaching with vis feedback
      // practice_mask: [],
      // probe: []
    }
  }

  preload() {
    this.load.image('next', 'assets/next.png')
  }

  create() {
    let config = this.game.config
    let user_config = this.game.user_config
    let hand = user_config.hand // 'right' or 'left'
    // camera (origin is center)
    this.cameras.main.setBounds(-config.width / 2, -config.height / 2, config.width, config.height)
    let height = config.height
    let hd2 = height / 2
    this.trial_counter = 0
    this.entering = true
    this.state = states.INSTRUCT
    // used for imagery component
    // this.rts = []
    // this.movets = []
    this.is_debug = user_config.debug



    // if (this.is_debug) {
    //   this.trials = generateTrials(5, true)
    //   this.typing_speed = 1
    // } else {
    //   // 40 repeats = 80 trials in probe section
    //   this.trials = generateTrials(40, false)
    //   this.typing_speed = 50
    // }
    // this.staircase = new Staircase(1, MAX_STAIRCASE, 1) // min of 1 frame, max of 10 frames (probably 166ms on 60hz machines?), steps of 1 frame


    // INSTRUCTIONS
    // start with some practice
    this.instruct_mode = 1
    // DEBUG ONLY
    this.debug_next = this.add.image(400, -450, 'next')
    .setScale(.2)
    .setInteractive()
    .setAlpha(0.7)
    .on('pointerdown', () => {
      if (this.state = states.INSTRUCT) {
        // this.instruct_mode = 2
        this.instructions_next.setVisible(false).removeAllListeners()
        this.instructions_title_group.setVisible(false)
        this.instructions_group_1.setVisible(false)
        this.debug_next.setVisible(false).removeAllListeners()
        this.trial_success_count = 2
        this.next_trial()
        return
      }
    }).on('pointerover', () => {
      this.debug_next.setAlpha(1)
    }).on('pointerout', () => {
      this.debug_next.setAlpha(0.7)
    }).setVisible(false)

    this.origin_obj = this.add.circle(0, CURSOR_START_Y, 15, WHITE).setVisible(false)
    this.origin = new Phaser.Geom.Circle(0, CURSOR_START_Y, CENTER_SIZE_RADIUS) // NOT AN OBJECT

    this.instructions_title_group = this.add.group()
    this.instructions_title_group.add(this.add.rectangle(-310, -480, 425, 80, SALMON, 0.9))
    this.instructions_title_group.add(this.add.rectangle(-300, -470, 425, 80, CYAN, 0.9))
    this.instructions_title_group.add(this.add.text(-500, -500, 'INSTRUCTIONS', {
      fontFamily: 'Verdana',
      fontSize: 50,
      align: 'left'
    }))

    this.instructions_next = this.add.image(400, 450, 'next')
      .setScale(.2)
      .setAlpha(.7)

    let instructions_font_params = {
      fontFamily: 'Verdana', 
      fontSize: 30,
      align: 'left'
    }

    this.instructions_group_1 = this.add.group()
    this.instructions_group_1.add(this.add.text(-500, -350,
      'In this game, your goal is to collect as many points as possible.\n\nThe more points you collect, the greater your bonus.',
      instructions_font_params))
    this.instructions_group_1.add(this.add.rectangle(-450, -200, 100, 10, WHITE))
    this.instructions_group_1.add(this.add.text(-500, -160,
      'Start a trial by moving your mouse to a white circle at the\nbottom of the screen.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.text(-500, -50,
      'When the white circle turns green, move your mouse upwards.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.text(-500, 20,
      'Three red-hued targets will gradually appear. Each target has\na point value that changes every trial.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.text(-500, 130,
      'The brighter the hue, the higher the point value.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.rectangle(-450, 210, 100, 10, WHITE).setVisible(false))
    this.instructions_group_1.add(this.add.text(-500, 260,
      'Quickly move to a target to select it - if you are too slow,\nyou get no points!',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.text(-500, 380,
      'Let\'s start with some practice rounds.',
      instructions_font_params).setVisible(false))

    this.instructions_holdwhite = this.add.text(-470, 380, 'Hold your mouse here   >>', {
      fontFamily: 'Verdana',
      fontSize: 30,
      align: 'right'
    }).setVisible(false)
    this.instructions_moveup = this.add.text(-470, 300, 'Move your mouse upwards...', {
      fontFamily: 'Verdana',
      fontSize: 30,
      align: 'left'
    }).setVisible(false)
    this.instructions_hitred = this.add.text(0, -500, 'Hit one of these targets!', {
      fontFamily: 'Verdana',
      fontSize: 30,
      align: 'center'
    }).setVisible(false).setOrigin(0.5, 0.5)

    let trial_params_1 = {
      n_trials: 20,
      difficulty: 0,
      probe_prob: 0,
      n_targets: 3
    }
    this.practice_trials_1 = generateTrials(trial_params_1)
    
    this.instructions_group_2 = this.add.group()
    this.instructions_group_2.add(this.add.text(-500, -350,
      'Good job!\n\nNow, the actual game will be more difficult.',
      instructions_font_params).setVisible(false))
    // this.instructions_group_2.add(this.add.rectangle(-450, -200, 100, 10, WHITE).setVisible(false))
    this.instructions_group_2.add(this.add.text(-500, -160,
      'Even if the targets look the same color, just try your best!',
      instructions_font_params).setVisible(false))
    this.instructions_group_2.add(this.add.text(-500, -50,
      'Once you are ready, click the arrow to begin.',
      instructions_font_params).setVisible(false))
    // this.instructions_group_2.add(this.add.text(-500, 20,
    //   'Remember: in a trial, the target values do not change;\nonly what you see changes!',
    //   instructions_font_params).setVisible(false))
    // this.instructions_group_2.add(this.add.rectangle(-450, 130, 100, 10, WHITE).setVisible(false))
    // this.instructions_group_2.add(this.add.text(-500, 170,
    //   'Let\'s try some more practice rounds.',
    //   instructions_font_params).setVisible(false))
    // this.instructions_group_2.setVisible(false)

    let trial_params_2 = {
      n_trials: 20,
      difficulty: 1,
      probe_prob: 0,
      n_targets: 3
    }
    this.practice_trials_2 = generateTrials(trial_params_2)

    this.instructions_group_3 = this.add.group()
    this.instructions_group_3.add(this.add.text(-500, -300,
      'Good job! You are ready.\n\nOnce you click the arrow, the experiment will begin.',
      instructions_font_params).setVisible(false))
    this.instructions_group_3.setVisible(false)

    

    // TARGETS
    let n_targets_total = 3
    let deg_min = -30
    let deg_max = 30
    let deg_dif = (deg_max - deg_min) / (n_targets_total - 1)
    let degs = []
    for (let i = 0; i < n_targets_total; i++) {
      degs.push(TARGET_REF_ANGLE + deg_min + i * deg_dif)
    }

    console.log(degs)

    this.target_objs = []
    this.target_outlines = []
    for (const deg of degs) {
      let radians = Phaser.Math.DegToRad(deg)
      let x = TARGET_DISTANCE * Math.cos(radians)
      let y = TARGET_DISTANCE * Math.sin(radians)
      let target_obj = this.add.circle(x, y + CURSOR_START_Y, TARGET_SIZE_RADIUS, BRIGHTRED).setVisible(false)
      let target_outline = this.add.circle(x, y + CURSOR_START_Y, TARGET_SIZE_RADIUS).setStrokeStyle(8, WHITE).setVisible(false)

      this.target_objs.push(target_obj)
      this.target_outlines.push(target_outline)
    }

    // let practice_params = {
    //   n_trials: 10,
    //   n_targets: 3,
    //   difficulty: 0,
    //   probe_interval: 1
    // }

    let trial_params = {
      n_trials: 50,
      difficulty: 2,
      probe_prob: 1/4,
      n_targets: 3
    }
    this.trials = generateTrials(trial_params)


    // this.q1 = this.add.text(0, hd2 / 3, `Which side did the cursor go toward,\n left (${rk['side']['left']}) or right (${rk['side']['right']})?`, {
    //   fontFamily: 'Verdana',
    //   fontStyle: 'bold',
    //   fontSize: 50,
    //   color: '#ffffff',
    //   align: 'center',
    //   stroke: '#444444',
    //   strokeThickness: 4
    // }).
    //   setOrigin(0.5, 0.5).setVisible(false)

    // this.instruction_button = this.add
    //   .rectangle(400, 400, 100, 50, WHITE)
    //   .setInteractive()
    //   .on('pointerdown', () => {
    //     console.log(this.instructions_idx)
    //     // this.examples.basic.stop()
    //     // this.examples.basic.visible = false
    //     // this.examples.mask.stop()
    //     // this.examples.mask.visible = false
    //     // this.next_trial()
    //     // this.darkener.visible = false
    //     // this.instructions.visible = false
    //     // this.instructions.text = ''
    //     // this.start_txt.visible = false
    //     this.instructions_idx++
    //     this.update_instructions()
    //   })

    // big fullscreen quad in front of game, but behind text instructions
    // this.darkener = this.add.rectangle(0, 0, height, height, 0x000000).setAlpha(1)

    // noise arc
    // this.textures.generate('noise', { data: noise_tex, pixelWidth: 3, pixelHeight: 3 })
    // noise is the thing we draw
    // to "randomize", do a setPosition with two random ints
    // then rotate to some random PI*n/2
    // this.noise = this.add.image(0, 0, 'noise').setVisible(false)
    // let data = make_thick_arc(
    //   Math.PI + Math.PI / 3,
    //   Math.PI * 2 - Math.PI / 3,
    //   200,
    //   CENTER_SIZE_RADIUS * 2 + 5,
    //   TARGET_DISTANCE * 2 - TARGET_SIZE_RADIUS * 2
    // )

    // let mask = this.add.polygon(0, 0, data, 0xffffff).setVisible(false).setDisplayOrigin(0, 0)
    // this.noise.mask = new Phaser.Display.Masks.BitmapMask(this, mask)

    // other warnings
    // this.other_warns = this.add.
    //   rexBBCodeText(0, 0, '', {
    //     fontFamily: 'Verdana',
    //     fontStyle: 'bold',
    //     fontSize: 50,
    //     color: '#ffffff',
    //     align: 'center',
    //     stroke: '#444444',
    //     backgroundColor: '#000000',
    //     strokeThickness: 4
    //   }).
    //   setOrigin(0.5, 0.5).
    //   setVisible(false)

    // this.instructions = TypingText(this, 0, 0, '', {
    //   fontFamily: 'Verdana',
    //   fontSize: 22,
    //   wrap: {
    //     mode: 'word',
    //     width: 800
    //   }
    // }).setVisible(false)

    

    this.start_txt = this.add.
      text(0, hd2 - 100, 'Click the mouse button to continue.', {
        fontFamily: 'Verdana',
        fontSize: 50,
        align: 'center'
      }).
      setOrigin(0.5, 0.5).
      setVisible(false)

    this.reward_txt = this.add.text(0, 0, '', {
      fontFamily: 'Verdana', 
      fontSize: 50,
      align: 'center'
    }).
    setOrigin(0.5, 0.5).
    setVisible(false)

    this.debug_txt = this.add.text(-hd2, -hd2, '')
    this.progress = this.add.text(hd2, -hd2, '').setOrigin(1, 0)
    // this.tmp_counter = 1
    this.total_len = countTrials(this.trials)
    // examples
    // this.examples = {
    //   // go + feedback
    //   basic: new BasicExample(this, 0, 200, true, false, rk['side']['right']).setVisible(false),
    //   mask: new BasicExample(this, 0, 200, true, true, rk['side']['right']).setVisible(false)
    // }

    // question responses
    // this.resp_queue = []
    // this.rt_ref = 0 //
    // this.input.keyboard.on(`keydown-${rk['side']['left']}`, (evt) => {
    //   this.resp_queue.push({side: 'l', rt: evt.timeStamp - this.rt_ref})
    // })

    // this.input.keyboard.on(`keydown-${rk['side']['right']}`, (evt) => {
    //   this.resp_queue.push({side: 'r', rt: evt.timeStamp - this.rt_ref})
    // })

    // start the mouse at offset
    // this.raw_x = CURSOR_RESTORE_X
    // this.raw_y = CURSOR_RESTORE_Y
    // this.next_trial()

    // set up mouse callback (does all the heavy lifting)
    // this.input.on('pointerdown', () => {
    //   if (this.state !== states.END) {
    //     // this.scale.startFullscreen()
    //     this.time.delayedCall(300, () => {
    //       this.input.mouse.requestPointerLock()
    //     })
    //   }
    // })
    // this.input.on('pointerlockchange', () => {
    //   console.log('oh no, this does not work')
    // })

    // this.input.on('pointermove', (ptr) => {
    //   let time = window.performance.now() // the time in the ptr should be a little quicker...
    //   if (this.input.mouse.locked) {
    //     // scale movement by const factor
    //     let dx = ptr.movementX * MOVE_SCALE
    //     let dy = ptr.movementY * MOVE_SCALE
    //     // update "raw" mouse position (remember to set these back to (0, 0)
    //     // when starting a new trial)
    //     this.raw_x += dx
    //     this.raw_y += dy
    //     this.raw_x = clamp(this.raw_x, -hd2, hd2)
    //     this.raw_y = clamp(this.raw_y, -hd2, hd2)

    //     // useful for deciding when to turn on/off visual feedback
    //     let extent = Math.sqrt(Math.pow(this.raw_x, 2) + Math.pow(this.raw_y, 2))
    //     // convert cursor angle to degrees
    //     let cursor_angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Normalize(Math.atan2(this.raw_y, this.raw_x)))
    //     let curs_x = this.raw_x
    //     let curs_y = this.raw_y
    //     // this.dbg_cursor.setPosition(curs_x, curs_y)

    //     this.cursor_angle = cursor_angle
    //     this.user_cursor.x = curs_x
    //     this.user_cursor.y = curs_y
    //     this.extent = extent

    //     if (this.state === states.MOVING) {
    //       this.trial_data.push({
    //         callback_time: time,
    //         evt_time: ptr.moveTime,
    //         raw_x: this.raw_x,
    //         raw_y: this.raw_y,
    //         cursor_x: curs_x,
    //         cursor_y: curs_y,
    //         cursor_extent: extent,
    //         cursor_angle: cursor_angle
    //       })
    //     }
    //   }
    // })
    // initial instructions (move straight through target)
    // instruct_txts['instruct_basic'] =
    //   `You will see three circular [color=red]red[/color] targets.\n\nMove the cursor with your mouse into the white circle at the bottom of the screen to start a trial.\n\nWhen the white circle turns [color=#00ff00]green[/color], move your mouse toward the targets.\n\n`

    // instruct_txts['instruct_mask'] =
    //   'In this section, the cursor will be [color=yellow]hidden[/color] by an image at the beginning and end of the movement. The image will be temporarily removed partway through the movement, and you will be able to see the cursor then.\n\nWe will ask you to answer the same question as before:\n\nWhich side of the target do you think the cursor went toward?\n\nRemember to try to make [color=yellow]straight[/color][/b] mouse movements.'

    // instruct_txts['instruct_probe'] =
    //   'Great job! We\'ll continue these trials until the end.\n\nThe amount of time the cursor is [color=yellow]hidden[/color] may vary over time and you may need to guess sometimes, but always do your best to make [color=yellow]straight mouse movements to the target[/color] and answer the question as best you can.'
  } // end create

  // reset_mouse() {
  //   this.user_cursor.x = CURSOR_RESTORE_X
  //   this.user_cursor.y = CURSOR_RESTORE_Y
  //   this.raw_x = CURSOR_RESTORE_X
  //   this.raw_y = CURSOR_RESTORE_Y
  // }

  reset_targets() {
    for (let i = 0; i < this.target_objs.length; i++) {
      this.target_objs[i].setFillStyle(BRIGHTRED).setVisible(false)
      this.target_outlines[i].setVisible(false)
    }
    this.targets_visible = false
    this.origin_obj.setVisible(false)
  }

  show_instructions(mode) {
    this.instructions_title_group.setVisible(true)
    this.instructions_next.setVisible(true)
      .setInteractive()
      .setAlpha(0.7)
      .on('pointerover', () => {
        this.instructions_next.setAlpha(1)
      }).on('pointerout', () => {
        this.instructions_next.setAlpha(0.7)
      })
    this.instructions_idx = 0
    let group;
    let idx_count;
    if (mode === 1) {
      group = this.instructions_group_1
      this.instructions_idx = 1
      idx_count = 7
    } else if (mode === 2) {
      group = this.instructions_group_2
      group.getChildren()[0].setVisible(true)
      // this.instructions_idx = 1
      idx_count = 1
    } else if (mode === 3) {
      group = this.instructions_group_3
      idx_count = 3
    }
    group.getChildren()[0].setVisible(true)
    this.instructions_next.on('pointerdown', () => {
      if (this.instructions_idx > idx_count) {
        this.instructions_next.setVisible(false).removeAllListeners()
        this.instructions_title_group.setVisible(false)
        group.setVisible(false)
        this.trial_success_count = 0
        this.cur_trial_ix = -1
        this.next_trial()
        return
      }
      this.instructions_idx++;
      group.getChildren()[this.instructions_idx].setVisible(true)
    })
  }

  update() {
    switch (this.state) {
    case states.INSTRUCT:
      // this.next_trial()
      // this.darkener.visible = false
      // this.instructions.visible = false
      // this.instructions.text = ''
      // this.start_txt.visible = false
      // break;
      
      if (this.entering) {
        this.entering = false
        console.log("Entering INSTRUCT")
        this.reward_txt.setVisible(false)


        console.log(this.instruct_mode)
        this.show_instructions(this.instruct_mode)
        // this.instructions_idx = 0
        // this.hold_waiting = false
        // this.update_instructions()
        // this.instructions_txt.setText(this.instructions[this.instructions_idx])
        // show the right instruction text, wait until typing complete
        // and response made
        // this.noise.visible = false
        // this.instructions.visible = true
        // this.darkener.visible = true
        // let tt = 'instruct_basic'
        // this.instructions.start(instruct_txts[tt], this.typing_speed)
        // if (tt === 'instruct_basic') {
        //   // this.examples.basic.visible = true
        //   // this.examples.basic.play()
        // } else if (tt === 'instruct_mask' || tt === 'instruct_probe') {
        //   // this.examples.mask.visible = true
        //   // this.examples.mask.play()
        // }
        // this.instructions.typing.once('complete', () => {
          // this.start_txt.visible = true
          // this.input.once('pointerdown', () => {
          //   this.examples.basic.stop()
          //   this.examples.basic.visible = false
          //   this.examples.mask.stop()
          //   this.examples.mask.visible = false
          //   this.next_trial()
          //   this.darkener.visible = false
          //   this.instructions.visible = false
          //   this.instructions.text = ''
          //   this.start_txt.visible = false
          // })
        //   this.next_trial()
        // })
        
        
      }

      break
    case states.PRETRIAL:
      if (this.entering) {
        this.entering = false
        console.log("Entering PRETRIAL")
        // how long you have to be inside circle to start trial
        this.hold_val = randint(50, 100)
        this.reset_targets()
        this.origin_obj.setVisible(true)
        this.reward_txt.setVisible(false)
        // this.t_ref = window.performance.now()
        // draw mask, if needed
        // this.noise.visible = this.current_trial.is_masked
        // if (this.is_debug) {
        //   let current_trial = this.current_trial
        //   let txt = current_trial['trial_type']
        //   txt += current_trial['trial_label'] ? ', ' + current_trial['trial_label'] + ', ' : ''
        //   txt += current_trial['pos'] ? current_trial['pos'] : ''
        //   this.debug_txt.text = txt
        // }
        if (this.instruct_mode === 1) {
          this.instructions_holdwhite.setVisible(true)
        }
        // check to see if cursor is inside start circle
        this.origin_obj.setInteractive()
          .on('pointerover', () => {
            this.hold_counter = 0;
            this.hold_waiting = true;
            console.log('over')
          })
          .on('pointerleave', () => {
            this.hold_counter = 0;
            this.hold_waiting = false;
          })
        
      }
      if (this.hold_waiting) {
        this.hold_counter++
        if (this.hold_counter > this.hold_val) {
          this.hold_counter = 0;
          this.hold_waiting = false;
          this.state = states.MOVING
        }
      }
      
      break
    case states.MOVING:
      // for non-probe trials, they control the cursor
      // for probe trials, there's a fixed cursor animation
      // that runs completely, regardless of what they do with the cursor
      // only thing they control on probe is initiation time
      let current_trial = this.current_trial
      if (this.entering) {
        this.entering = false
        console.log("Entering MOVING")
        for (let i = 0; i < this.target_objs.length; i++) {
          this.target_outlines[i].setVisible(false)
        }
        console.log(current_trial.type)
        // console.log('values', current_trial.values)
        // console.log('rewards', current_trial.rewards)
        // this.reference_time = this.game.loop.now
        // this.last_frame_time = this.game.loop.now
        // this.dropped_frame_count = 0
        // this.dts = []
        // every trial starts at 0, 0
        // this.trial_data.splice(0, 0, {
        //   callback_time: this.reference_time,
        //   evt_time: this.reference_time,
        //   raw_x: 0,
        //   raw_y: 0,
        //   cursor_x: 0,
        //   cursor_y: 0,
        //   cursor_extent: 0,
        //   cursor_angle: 0
        // })
        this.origin_obj.fillColor = GREEN

        if (this.instruct_mode === 1) {
          this.instructions_holdwhite.setVisible(false)
          this.instructions_moveup.setVisible(true)
        }

        for (let i = 0; i < this.target_objs.length; i++) {
          let target = this.target_objs[i]
          target.setInteractive().on('pointerover', () => {
            this.origin_obj.fillColor = WHITE
            // this.user_cursor.visible = false
            this.target_outlines[i].setVisible(true)

            if (this.instruct_mode > 0) {
              this.instructions_hitred.setVisible(false)
            }

            this.selection = i
            this.value = this.current_trial.values[i]
            this.reward = this.current_trial.rewards[i]
            // displayed reward is *4+1, so reward is at least 1
            // avg reward is 3
            // if (this.current_trial.type === "normal") {
            //   this.reward = Math.round(1 + this.value * 4)
            // } else if (this.current_trial.type === "probe") {
            //   this.reward = Math.round(2 + 3 * Math.random())
            // }
            this.trial_success_count++
            
            // this.target_outlines[i].setStrokeStyle(5, BRIGHTRED)
            // if (current_trial.ask_questions) {
            //   this.state = states.QUESTIONS
            // } else { // jumping straight to the posttrial, feed in some junk
            //   this.resp_queue.splice(0, 0, {side: 'x', rt: 0})
            //   this.state = states.POSTTRIAL
            // }
            this.state = states.POSTTRIAL
          })
        }


        
      } else { // second iter ++
        // let est_dt = 1 / this.game.user_config.refresh_rate_guess * 1000
        // let this_dt = this.game.loop.now - this.last_frame_time
        // this.dropped_frame_count += this_dt > 1.5 * est_dt
        // this.dts.push(this_dt)
        // this.last_frame_time = this.game.loop.now
      }
      // console.log(this.targets[0])

      // check if cursor is in target
      for (let i = 0; i < this.target_objs.length; i++) {
        let target = this.target_objs[i]
        let pointerx = this.input.mousePointer.x - this.game.config.width/2
        let pointery = this.input.mousePointer.y - this.game.config.height/2
        let target_dist = dist(target, {x: pointerx, y: pointery})

        if ((this.instruct_mode === 1) && (target_dist < 650)) {
          this.instructions_moveup.setVisible(false)
          this.instructions_hitred.setVisible(true)
        }

        if ((!this.targets_visible) && (target_dist < 650)) {
          for (let j = 0; j < this.target_objs.length; j++) {
            this.target_objs[j].setVisible(true)
          }
          this.targets_visible = true
        }
        // console.log(this.current_trial)
        // don't bother updating colors if it's a probe trial
        if (this.current_trial.type === "normal") {
          // cursor is not in target, so just update colors
          
          // let dif_coef = 1
          // let dist_coef = 1
          // if (this.current_trial.difficulty != 0) {
          //   dif_coef = 1 / this.current_trial.difficulty
          //   dist_coef = Math.min(150000 / Math.pow(target_dist, 2), 1)
          // }
          
          // let value_coef = 2 * (this.current_trial.values[i] - 0.5)
          // // a product of target val, inv distance^2, and inv difficulty
          // let red_shade = 175 + 75 * value_coef * dif_coef * dist_coef
          // console.log(dist_coef, dif_coef, red_shade)
          // let red_rgb_color = Phaser.Display.Color.GetColor(red_shade, 50, 50)
          // target.setFillStyle(red_rgb_color)
        } else {
          // console.log(this.current_trial.type)
        }
        let value_coef = 2 * (this.current_trial.values[i] - 0.5)
        let red_shade = 175 + 75 * value_coef
        // console.log(dist_coef, dif_coef, red_shade)
        let red_rgb_color = Phaser.Display.Color.GetColor(red_shade, 50, 50)
        target.setFillStyle(red_rgb_color)
        
      }

      break
    // case states.QUESTIONS:
    //   if (this.entering) {
    //     this.entering = false
    //     this.rt_ref = this.game.loop.now
    //     this.resp_queue = [] // empty queue
    //     this.q1.visible = true
    //   }
    //   if (this.resp_queue.length > 0) {
    //     this.state = states.POSTTRIAL
    //     this.q1.visible = false
    //   }
    //   break
    case states.POSTTRIAL:
      if (this.entering) {
        this.entering = false
        // let current_trial = this.current_trial
        // let correct = true
        // let resp = this.resp_queue[0]
        // let cur_stair = this.staircase.next()

        let reward_txt;
        if (this.reward === 1) {
          reward_txt = "You received 1 point!"
        } else {
          reward_txt = `You received ${this.reward} points!`
        }
        this.reward_txt.setText(reward_txt)
        this.reward_txt.setVisible(true)
        for (let i = 0; i < this.target_objs.length; i++) {
          this.target_objs[i].removeAllListeners()
        }
        
        // deal with trial data
        // let trial_data = {
        //   movement_data: this.trial_data,
        //   ref_time: this.reference_time,
        //   trial_number: this.trial_counter++,
        //   target_size_radius: TARGET_SIZE_RADIUS, // fixed above
        //   cursor_size_radius: CURSOR_SIZE_RADIUS,
        //   iti: this.inter_trial_interval, // amount of time between cursor appear & teleport
        //   hold_time: this.hold_val,
        //   which_side: resp,
        //   n_frames: cur_stair, // get current stair value
        //   correct: correct,
        //   dropped_frame_count: this.dropped_frame_count
        // }
        // let combo_data = merge_data(current_trial, trial_data)
        let delay = 1200
        let fbdelay = 0
        // // feedback about movement angle (if non-imagery)
        // let first_element = trial_data.movement_data[1]
        // let last_element = trial_data.movement_data[trial_data.movement_data.length - 1]
        // let target_angle = current_trial.target_angle

        // let reach_angles = this.trial_data.filter((a) => a.cursor_extent > 15).map((a) => a.cursor_angle)
        // let end_angle = reach_angles.slice(-1)
        // let norm_reach_angles = reach_angles.map((a) => signedAngleDeg(a, end_angle))
        // let reaction_time = null
        // let reach_time = null
        // if (last_element && trial_data.movement_data.length > 2) {
        //   reaction_time = first_element.evt_time - this.reference_time
        //   reach_time = last_element.evt_time - first_element.evt_time
        // }
        // if (!(reaction_time === null)) {
        //   this.rts.push(reaction_time)
        //   this.movets.push(reach_time)
        // }
        // let punished = false
        // let punish_delay = 3000
        // let punish_flags = 0
        // if (Math.abs(signedAngleDeg(last_element.cursor_angle, target_angle)) >= 30) {
        //   punish_flags |= Err.reached_away
        //   if (!punished) {
        //     punished = true
        //     this.other_warns.text = '[b]Make reaches toward\nthe [color=#00ff00]green[/color] target.[/b]'
        //   }
        // }
        // if (reaction_time >= 800) {
        //   punish_flags |= Err.late_start
        //   if (!punished) {
        //     punished = true
        //     this.other_warns.text = '[b]Please start the\nreach sooner.[/b]'
        //   }
        // }
        // if (reach_time >= 400) {
        //   // slow reach
        //   punish_flags |= Err.slow_reach
        //   if (!punished) {
        //     punished = true
        //     this.other_warns.text = '[b]Please move quickly\n[color=yellow]through[/color] the target.[/b]'
        //   }
        // }
        // if (mad(norm_reach_angles) > 10) {
        //   // wiggly reach
        //   punish_flags |= Err.wiggly_reach
        //   if (!punished) {
        //     punished = true
        //     this.other_warns.text = '[b]Please make [color=yellow]straight[/color]\nreaches toward the target.[/b]'
        //   }
        // }
        // if (punished) {
        //   delay += punish_delay
        //   this.other_warns.visible = true
        //   this.time.delayedCall(punish_delay, () => {
        //     this.other_warns.visible = false
        //   })
        // }
        // combo_data['delay_time'] = delay
        // combo_data['reaction_time'] = reaction_time
        // combo_data['reach_time'] = reach_time


        this.time.delayedCall(fbdelay, () => {
          this.time.delayedCall(delay, () => {
            // combo_data['any_punishment'] = punished
            // combo_data['punish_types'] = punish_flags
            // console.log(combo_data)
            // this.all_data[current_trial.trial_type].push(combo_data)
            // this.tmp_counter++
            // this.raw_x = this.raw_y = this.user_cursor.x = this.user_cursor.y = CURSOR_RESTORE_POINT
            // this.user_cursor.visible = true
            this.tweens.add({
              targets: this.user_cursor,
              scale: { from: 0, to: 1 },
              ease: 'Elastic',
              easeParams: [5, 0.5],
              duration: 800,
              onComplete: () => {
                this.next_trial()
              }
            })
          })
        })
        // this.next_trial()
      }
      break
    // case states.END:
    //   if (this.entering) {
    //     this.entering = false
    //     this.input.mouse.releasePointerLock()
    //     // fade out
    //     this.tweens.addCounter({
    //       from: 255,
    //       to: 0,
    //       duration: 2000,
    //       onUpdate: (t) => {
    //         let v = Math.floor(t.getValue())
    //         this.cameras.main.setAlpha(v / 255)
    //       },
    //       onComplete: () => {
    //         // this.scene.start('QuestionScene', { question_number: 1, data: this.all_data })
    //         this.scene.start('EndScene', this.all_data)
    //       }
    //     })
    //   }
    //   break
    }
  } // end update

  get state() {
    return this._state
  }

  set state(newState) {
    this.entering = true
    this._state = newState
  }

  update_instructions() {
    switch (this.instructions_idx) {
      // case 0:

    case 0:
      // this.instructions_group.getChildren()[this.instructions_idx].setVisible()
      // this.instructions_txt1.setText(
      //   'In each trial, there will be three red targets at the top of the screen...',
      // )
      break

    // case 1:
    //   for (const t of this.target_objs) {
    //     t.setVisible(true)
    //   }
    //   break
    // case 2:
    //   this.instructions_txt2.setText(
    //     '...and a small white circle at the bottom of the screen.'
    //   )
    //   break
    // case 3:
    //   this.origin_obj.setVisible(true)
    //   break
    // case 4:
    //   this.instructions_txt1.setText('To start a trial, move your cursor over the white circle.')
    //   this.instructions_txt2.setText('Once the white circle turns green, quickly move your mouse to one of the red targets.')
    //   this.instructions_next.setVisible(false)
    //   this.origin_obj.setInteractive()
    //     .on('pointerover', () => {
    //       this.hold_counter = 0
    //       this.hold_waiting = true
    //     }).on('pointerleave', () => {
    //       this.hold_counter = 0
    //       this.hold_waiting = false
    //     })
    //   break
    // case 4:
    //   this.instructions_txt3.setVisible()
    //   // this.instructions_txt2.setText('')
    //   // this.instructions_next.setVisible(false)
    //   // this.origin_obj.setInteractive()
    //   //   .on('pointerover', () => {
    //   //     this.hold_counter = 0
    //   //     this.hold_waiting = true
    //   //   }).on('pointerleave', () => {
    //   //     this.hold_counter = 0
    //   //     this.hold_waiting = false
    //   //   })
    //   break
    // default:
    //   this.instructions_txt1.setVisible(false)
    //   this.instructions_txt2.setVisible(false)
    //   this.next_trial()
    }

    
  }

  next_trial() {
    // move to the next trial, and set the state depending on trial_type
    // if (this.tmp_counter > this.total_len) {
    //   this.progress.visible = false
    // } else {
    //   this.progress.text = `${this.tmp_counter} / ${this.total_len}`
    // }
    if (this.instruct_mode === 1) {
      // console.log(this.trial_success_count)
      if (this.trial_success_count >= 3) {
        this.instruct_mode = 2
        this.state = states.INSTRUCT
        this.reset_targets()
        return
      }
      this.cur_trial_ix = (this.cur_trial_ix + 1) % this.practice_trials_1.length
      this.current_trial = this.practice_trials_1[this.cur_trial_ix]
      // console.log(this.current_trial)
    } else {
      if (this.instruct_mode === 2) {
        this.instruct_mode = 0
      }
      this.cur_trial_ix += 1
      this.current_trial = this.trials[this.cur_trial_ix]
    }

    
    
    // let cur_trial = this.current_trial
    // let tt = ''
    // if (cur_trial !== undefined) {
    //   tt = cur_trial.trial_type
    // }
    // if (cur_trial === undefined || this.trials.length < 1 && tt.startsWith('break')) {
    //   this.state = states.END
    // } else if (tt.startsWith('instruct_') || tt.startsWith('break')) {
    //   this.state = states.INSTRUCT
    // } else if (
    //   tt.startsWith('practice') ||
    //   tt.startsWith('probe')
    // ) {
    //   this.state = states.PRETRIAL
    // } else {
    //   // undefine
    //   console.error('Oh no, wrong next_trial.')
    // }
    this.state = states.PRETRIAL
  }
}
