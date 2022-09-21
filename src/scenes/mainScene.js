import { TypingText } from '../objects/typingtext'
import { Enum } from '../utils/enum'
import { clamp } from '../utils/clamp'
import { randint, randchoice } from '../utils/rand'
import generateTrials from '../utils/trialgen'

// import make_thick_arc from '../utils/arc'

// const fs = require('node:fs');


const WHITE = 0xffffff
const GREEN = 0x39ff14 // actually move to the target
const RED = 0xff0000
const BRIGHTRED = Phaser.Display.Color.GetColor(175, 50, 50)
const DARKGRAY = 0x444444
const GRAY = Phaser.Display.Color.GetColor(100, 100, 100)
const LIGHTGRAY = Phaser.Display.Color.GetColor(150, 150, 150)
const CYAN = Phaser.Display.Color.GetColor(100, 150, 250)
const SALMON = Phaser.Display.Color.GetColor(250, 100, 100)

const TARGET_SIZE_RADIUS = 60
const ORIGIN_SIZE_RADIUS = 15
const MOVE_THRESHOLD = 4

const TARGET_DISTANCE = 850 // *hopefully* they have 300px available?
const TARGET_SHOW_DISTANCE = 800
const TARGET_REF_ANGLE = 270 // degrees, and should be pointed straight up
const TARGET_ANGLE = 50
const MOVE_TIME_LIMIT = 800
const PRACTICE_REACH_TIME_LIMIT = 1600
const REACH_TIME_LIMIT = 800
const CURSOR_START_Y = 450

const TRIAL_DELAY = 1200
const PRACTICE_TRIAL_PUNISH_DELAY = 500
const TRIAL_PUNISH_DELAY = 2000

const PI = Math.PI

const states = Enum([
  'INSTRUCT', // show text instructions (based on stage of task)
  'PRETRIAL', // wait until ready to start trial
  'MOVING', // the movement part
  // 'QUESTIONS', // which side did cursor go to?
  'POSTTRIAL', // auto teleport back to restore point
  'END' //
])

const Err = {
  none: 0,
  too_far: 1,
  too_slow_move: 2,
  too_slow_reach: 4,
  wiggly_reach: 8,
  returned_to_center: 16
}

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' })
    this._state = states.INSTRUCT
    this.entering = true
    this.all_trial_data = []

    // variables to start off with
    this.instruct_mode = 1
    this.points_count = 0
    this.instructions_shown = false

    this.n_trials = 20
    this.probe_prob = 2/3
    this.distance_mode = true

    let debug = false
    if (debug) {
      this.instruct_mode = 2
      this.n_trials = 20
      this.probe_prob = 0
    }

  }

  preload() {
    this.load.image('next', 'assets/next_instructions.png')
    this.load.image('next_debug', 'assets/next_debug.png')
    this.load.image('previous', 'assets/previous_instructions.png')
  }

  create() {
    let config = this.game.config
    let user_config = this.game.user_config
    // camera (origin is center)
    this.hd2 = config.height/2
    this.wd2 = config.width/2
    this.cameras.main.setBounds(-this.wd2, -this.hd2, this.wd2*2, this.hd2*2)
    this.trial_counter = 0
    this.state = states.INSTRUCT
    this.is_debug = user_config.debug

    // fancy "INSTRUCTIONS" title
    this.instructions_title_group = this.add.group()
    this.instructions_title_group.add(this.add.rectangle(-310, -480, 425, 80, SALMON, 0.9))
    this.instructions_title_group.add(this.add.rectangle(-300, -470, 425, 80, CYAN, 0.9))
    this.instructions_title_group.add(this.add.text(-500, -500, 'INSTRUCTIONS', {
      fontFamily: 'Verdana',
      fontSize: 50,
      align: 'left'
    }))

    // button to next set of instructions / next page
    this.arrow_next = this.add.image(400, 450, 'next')
      .setScale(.2)
      .setAlpha(.7)
    // button back to instructions
    this.arrow_back = this.add.image(-450, 450, 'previous')
      .setScale(.2)
      .setAlpha(.7)
      .setInteractive()
      .on('pointerover', () => {
        this.arrow_back.setAlpha(1)
      }).on('pointerout', () => {
        this.arrow_back.setAlpha(0.7)
      })
      .setVisible(false)
      .on('pointerdown', () => {
        this.state = states.INSTRUCT
        this.instruct_mode = 1
        this.instructions_holdwhite.setVisible(false)
        this.instructions_moveup.setVisible(false)
        this.instructions_hitred.setVisible(false)
        this.arrow_back.setVisible(false)
        this.reset_targets()
        this.origin_obj.setVisible(false)

      })

    let instructions_font_params = {
      fontFamily: 'Verdana', 
      fontSize: 30,
      align: 'left'
    }

    // first page of instructions
    if (this.distance_mode) {
      // distance_mode instructions
      this.instructions_group_1 = this.add.group()
      this.instructions_group_1.add(this.add.text(-500, -350,
        'In this game, your goal is to collect as many points as possible.\n\nThe more points you collect, the greater your bonus.',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rectangle(-450, -200, 100, 10, WHITE).setVisible(false))
      this.instructions_group_1.add(this.add.rexBBCodeText(-500, -160,
        'Start a trial by moving your mouse to a [b]white[/b] circle at the\nbottom of the screen.',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rexBBCodeText(-500, -50,
        'The [b]white[/b] circle will turn [b][color=#39ff14]green[/color][/b], and three [b][color=#FF3232]red-hued[/color][/b] targets will\nappear near the top of the screen. Each target has a point value\nthat changes every trial. ',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rexBBCodeText(-500, 90,
        'As you move your mouse closer to a target, it will get [b][color=#FF8888]brighter[/color][/b] or \n[b][color=#882222]duller[/color][/b] based on its value. Brighter targets usually have higher value.',
        instructions_font_params).setVisible(false))
      // this.instructions_group_1.add(this.add.rexBBCodeText(-500, 130,
      //   '',
      //   instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rectangle(-450, 210, 100, 10, WHITE).setVisible(false))
      this.instructions_group_1.add(this.add.text(-500, 260,
        'Quickly and accurately move to a target to select it - \nif you are too slow or you reach too far, you get no points!',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.text(-500, 380,
        'Let\'s start with some practice rounds.',
        instructions_font_params).setVisible(false))
    } else {
      // color mode instructions
      this.instructions_group_1 = this.add.group()
      this.instructions_group_1.add(this.add.text(-500, -350,
        'In this game, your goal is to collect as many points as possible.\n\nThe more points you collect, the greater your bonus.',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rectangle(-450, -200, 100, 10, WHITE).setVisible(false))
      this.instructions_group_1.add(this.add.rexBBCodeText(-500, -160,
        'Start a trial by moving your mouse to a [b]white[/b] circle at the\nbottom of the screen.',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rexBBCodeText(-500, -50,
        'When the white circle turns [b][color=#39ff14]green[/color][/b], move your mouse upwards.',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rexBBCodeText(-500, 20,
        'Three [b][color=#FF3232]red-hued[/color][/b] targets will appear near the top of the screen.\nEach target has a point value that changes every trial.',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rexBBCodeText(-500, 130,
        'The [b][color=#FFAAAA]brighter[/color][/b] the red hue, the higher the point value.',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.rectangle(-450, 210, 100, 10, WHITE).setVisible(false))
      this.instructions_group_1.add(this.add.text(-500, 260,
        'Quickly and accurately move to a target to select it - \nif you are too slow or you reach too far, you get no points!',
        instructions_font_params).setVisible(false))
      this.instructions_group_1.add(this.add.text(-500, 380,
        'Let\'s start with some practice rounds.',
        instructions_font_params).setVisible(false))
    }

    // instructions during practice rounds
    this.instructions_holdwhite = this.add.text(50, 430, '<<   Move your mouse here', instructions_font_params).setVisible(false)
    this.instructions_moveup = this.add.text(100, 300, 'Move your mouse upwards...', instructions_font_params).setVisible(false)
    this.instructions_hitred = this.add.text(0, -500, 'Hit one of these targets!', {
      fontFamily: 'Verdana',
      fontSize: 30,
      align: 'center'
    }).setVisible(false).setOrigin(0.5, 0.5)
    

    // practice round trials
    let trial_params_1 = {
      n_trials: 10,
      distance_mode: this.distance_mode,
      difficulty: 1,
      probe_prob: 0,
      n_targets: 3
    }
    this.practice_trials_1 = generateTrials(trial_params_1)
    

    // second page of instructions, before starting
    this.instructions_group_2 = this.add.group()
    this.instructions_group_2.add(this.add.text(-500, -350,
      'Good job!\n\nNow, the actual game will be more difficult.',
      instructions_font_params).setVisible(false))
    this.instructions_group_2.add(this.add.text(-500, -170,
      'You will have less time to make your movement, and\nthe colors will look more similar.\n\nJust try your best!',
      instructions_font_params).setVisible(false))
    this.instructions_group_2.add(this.add.text(-500, 100,
      'Once you are ready, click the arrow to begin.',
      instructions_font_params).setVisible(false))

    // text in the center displaying rewards and errors
    this.reward_txt = this.add.
      text(0, 0, '', {
        fontFamily: 'Verdana',
        fontSize: 50,
        align: 'center'
      }).
      setOrigin(0.5, 0.5).
      setVisible(false)

    // points counter in upper right hand corner
    this.points_txt = this.add.text(
      this.wd2 - 100, 100 -this.hd2, '', {fontSize: 30})
    .setOrigin(1, 0)

    // white circle people move their cursor to in order to start trial
    this.origin_obj = this.add.circle(0, CURSOR_START_Y, ORIGIN_SIZE_RADIUS, WHITE).setVisible(false)
    this.origin = new Phaser.Geom.Circle(0, CURSOR_START_Y, ORIGIN_SIZE_RADIUS) // NOT AN OBJECT

    // targets
    let n_targets_total = 3
    let deg_min = -TARGET_ANGLE
    let deg_max = TARGET_ANGLE
    let deg_dif = (deg_max - deg_min) / (n_targets_total - 1)
    let degs = []
    for (let i = 0; i < n_targets_total; i++) {
      degs.push(TARGET_REF_ANGLE + deg_min + i * deg_dif)
    }

    this.target_objs = []
    for (const deg of degs) {
      let radians = Phaser.Math.DegToRad(deg)
      let x = TARGET_DISTANCE * Math.cos(radians)
      let y = TARGET_DISTANCE * Math.sin(radians)
      let target_obj = this.add.circle(x, y + CURSOR_START_Y, TARGET_SIZE_RADIUS, BRIGHTRED).setStrokeStyle(8,WHITE).setVisible(false)

      this.target_objs.push(target_obj)
    }

    // actual trials for the experiment
    let trial_params = {
      n_trials: this.n_trials,
      distance_mode: this.distance_mode,
      difficulty: 2,
      probe_prob: this.probe_prob,
      n_targets: 3,
    }
    this.trials = generateTrials(trial_params)

    // this.tmp_counter = 1
    // this.total_len = countTrials(this.trials)
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

  } // end create


  reset_targets() {
    for (let i = 0; i < this.target_objs.length; i++) {
      this.target_objs[i].setFillStyle(BRIGHTRED).setStrokeStyle(0).setVisible(false)
    }
    this.targets_visible = false
    this.origin_obj.setVisible(false)
  }

  reset_screen() {
    this.reset_targets()
    this.reward_txt.setVisible(false)

  }

  show_instructions(mode, show_all=false) {
    this.instructions_title_group.setVisible(true)
    this.arrow_back.setVisible(false)
    this.arrow_next.setVisible(true)
      .setInteractive()
      .setAlpha(0.7)
      .on('pointerover', () => {
        this.arrow_next.setAlpha(1)
      }).on('pointerout', () => {
        this.arrow_next.setAlpha(0.7)
      })
    this.instructions_idx = 0
    let group;
    
    if (mode === 1) {
      group = this.instructions_group_1
      this.instructions_idx = 1
      group.getChildren()[1].setVisible(true)
    } else if (mode === 2) {
      group = this.instructions_group_2
    }
    let idx_count = group.getLength() - 1
    group.getChildren()[0].setVisible(true)
    if (show_all) {
      this.instructions_idx = idx_count
      group.setVisible(true)
    }
    this.arrow_next.on('pointerdown', () => {
      if (this.instructions_idx >= idx_count) {
        this.arrow_next.setVisible(false).removeAllListeners()
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
      
      if (this.entering) {
        this.entering = false
        console.log("Entering INSTRUCT")
        this.reset_screen()
        this.show_instructions(this.instruct_mode, this.instructions_shown)
        
      }

      break
    case states.PRETRIAL:
      if (this.entering) {
        this.entering = false
        console.log("Entering PRETRIAL")
        this.instructions_shown = true
        // how long you have to be inside circle to start trial
        this.hold_val = randint(50, 100)
        this.reset_targets()
        this.origin_obj.setVisible(true)
        this.reward_txt.setVisible(false)
        this.hold_waiting = false
        this.origin_obj.fillColor = WHITE
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
          this.arrow_back.setVisible(true)
        }

        this.pretrial_time = this.game.loop.now
        this.trial_data = {}
        this.trial_data['ix'] = this.cur_trial_ix
        this.trial_data['trial'] = this.current_trial
        this.trial_data['type'] = this.current_trial.type
        if (this.instruct_mode === 1) {
          this.trial_data['set'] = 'practice'
        } else {
          this.trial_data['set'] = 'main'
        }
        this.pointer_data = {'time': [], 'x': [], 'y': [], 'tvis': []}
        
      }

      // check if cursor inside start circle
      let mouse_in_origin = this.origin.contains(
        this.input.activePointer.x - this.wd2,
        this.input.activePointer.y - this.hd2)
      if (mouse_in_origin && !this.hold_waiting) {
          this.hold_counter = 0;
          this.hold_waiting = true;
          console.log('over')
      } else if (!mouse_in_origin && this.hold_waiting) {
        this.hold_counter = 0;
        this.hold_waiting = false;
        console.log('leave')
      }

      // wait for cursor inside start circle
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
      let current_trial = this.current_trial
      if (this.entering) {
        this.entering = false
        console.log("Entering MOVING")
        console.log(current_trial.type)
        // this.start_time = this.game.loop.now
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

        // start time is when the circle turns green
        // start time != target show time. record all timestamps anyway, relative to start time
        this.start_time = this.game.loop.now
        this.trial_data['pretrial_time'] = this.pretrial_time - this.start_time
        this.trial_data['start_time_abs'] = this.start_time

        if (this.instruct_mode === 1) {
          this.instructions_holdwhite.setVisible(false)
          this.instructions_hitred.setVisible(true)
          if (!this.distance_mode) {
            this.instructions_moveup.setVisible(true)
          }
        }

        if (this.distance_mode) {
          for (let j = 0; j < this.target_objs.length; j++) {
            this.target_objs[j].setVisible(true)
          }
          this.targets_visible = true
          
        }

        // test for hitting the target
        for (let i = 0; i < this.target_objs.length; i++) {
          let target = this.target_objs[i]
          target.setInteractive().on('pointerover', () => {
            this.target_objs[i].setStrokeStyle(8, WHITE)
            this.selection = i
            this.value = this.current_trial.values[i]
            this.reward = this.current_trial.rewards[i]
            this.trial_success_count++
            this.trial_error = Err.none
              
              // if (current_trial.ask_questions) {
              //   this.state = states.QUESTIONS
              // } else { // jumping straight to the posttrial, feed in some junk
              //   this.resp_queue.splice(0, 0, {side: 'x', rt: 0})
              //   this.state = states.POSTTRIAL
              // }
            
            this.state = states.POSTTRIAL
          })
        }
      }


      let cur_time = this.game.loop.now
      let pointerx = this.input.activePointer.x - this.wd2
      let pointery = this.input.activePointer.y - this.hd2

      // time, x, y, targets_visible
      this.pointer_data.time.push(cur_time - this.start_time)
      this.pointer_data.x.push(pointerx)
      this.pointer_data.y.push(pointery)
      this.pointer_data.tvis.push(this.targets_visible)

      // check if cursor is past target radius
      let pdist = Phaser.Math.Distance.Between(pointerx, pointery, this.origin.x, this.origin.y)
      // too far
      if (pdist >= TARGET_DISTANCE) {
        this.trial_error = Err.too_far
        this.reward = 0
        this.selection = -1
        this.value = 0
        this.state = states.POSTTRIAL
      }

      // check if we're overtime (to hit target), after targets are shown
      if (this.targets_visible) {
        let cur_trial_time = this.game.loop.now - this.start_time
        if (!this.distance_mode) {
          // in color mode, target_show_time exists
          cur_trial_time = this.game.loop.now - this.target_show_time
        }
        
        let time_lim = REACH_TIME_LIMIT
        if (this.instruct_mode > 0) {
          time_lim = PRACTICE_REACH_TIME_LIMIT
        }
        if (cur_trial_time > time_lim) {
          this.trial_error = Err.too_slow_reach
          this.state = states.POSTTRIAL
        }

        // setting target colors in distance mode
        if (this.distance_mode) {
          for (let j = 0; j < this.target_objs.length; j++) {
            let target = this.target_objs[j]
            let tdist = Phaser.Math.Distance.Between(pointerx, pointery, target.x, target.y)
            let difficulty_factor = this.current_trial.difficulty || .001
            let dist_coef = Math.min(1, TARGET_DISTANCE / tdist / this.current_trial.difficulty / 4)
            let value_coef = 2 * (this.current_trial.values[j] - 0.5)
            let red_shade = 175 + 75 * value_coef * dist_coef
            let red_rgb_color = Phaser.Display.Color.GetColor(red_shade, 50, 50)
            // console.log(j, this.current_trial.values[j], red_shade)
            this.target_objs[j].setFillStyle(red_rgb_color)
          }
        }
        

      } else {
        // check if we're overtime (to reach), before targets are shown
        let cur_trial_time = this.game.loop.now - this.start_time
        if (cur_trial_time > MOVE_TIME_LIMIT) {
          this.trial_error = Err.too_slow_move
          this.state = states.POSTTRIAL
        }

        // check if cursor is closer to targets, IF targets aren't visible yet
        for (let i = 0; i < this.target_objs.length; i++) {
          let target = this.target_objs[i]
          let this_target_dist = Phaser.Math.Distance.Between(pointerx, pointery, target.x, target.y)

          // show targets
          if (this_target_dist < TARGET_SHOW_DISTANCE) {
            // we want to measure (really) from when target is shown in color mode
            this.target_show_time = this.game.loop.now
            this.trial_data['target_show_time'] = this.target_show_time - this.start_time
            for (let j = 0; j < this.target_objs.length; j++) {
              this.target_objs[j].setVisible(true)
              // setting target colors
              if (!this.distance_mode) {
                let value_coef = 2 * (this.current_trial.values[j] - 0.5)
                let difficulty_factor = this.current_trial.difficulty || 1
                let red_shade = 175 + 75 * value_coef / this.current_trial.difficulty
                let red_rgb_color = Phaser.Display.Color.GetColor(red_shade, 50, 50)
                this.target_objs[j].setFillStyle(red_rgb_color)
              }
            }
            this.targets_visible = true
            // on practice trials, show instructions
            if (this.instruct_mode === 1) {
              this.instructions_moveup.setVisible(false)
              this.instructions_hitred.setVisible(true)
            }
          }
        }

        
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

        if (this.instruct_mode === 1) {
          this.instructions_hitred.setVisible(false)
        }
        this.origin_obj.fillColor = WHITE
        this.end_time = this.game.loop.now
        this.trial_time = this.end_time - this.target_show_time
        this.trial_data['end_time'] = this.end_time - this.start_time
        this.trial_data['trial_time'] = this.trial_time
        console.log('time', this.trial_time)

        this.trial_data['pointer_data'] = this.pointer_data
        console.log(this.trial_data)

        let punish_delay = 0
        if (this.trial_error === Err.none) {
          // no error happened
          let reward_txt;
          if (this.instruct_mode === 1) {
            if (this.reward === 1) {
              reward_txt = "This target is worth 1 point!"
            } else {
              reward_txt = `This target is worth ${this.reward} points!`
            }
          } else  {
            if (this.reward === 1) {
              reward_txt = "You received 1 point!"
            } else {
              reward_txt = `You received ${this.reward} points!`
            }
          }
          this.reward_txt.setText(reward_txt)
        } else {
          // some error happened
          this.trial_success_count = 0
          this.reward = 0
          this.selection = -1
          this.value = 0
          if (this.trial_error === Err.too_slow_move) {
            this.reward_txt.setText('Please move faster once the white circle turns green.')
          } else if (this.trial_error === Err.too_slow_reach) {
            this.reward_txt.setText('Too slow!')
          } else if (this.trial_error === Err.too_far) {
            this.reset_targets()
            this.reward_txt.setText('Move your cursor toward one of the targets.')
          }

          punish_delay = TRIAL_PUNISH_DELAY
          if (this.instruct_mode > 0) {
            punish_delay = PRACTICE_TRIAL_PUNISH_DELAY
          }
        }
        this.reward_txt.setVisible(true)
        if (this.instruct_mode === 0) {
          this.points_count += this.reward
          this.points_txt.setText('Points: ' + this.points_count)
        }
        
        for (let i = 0; i < this.target_objs.length; i++) {
          this.target_objs[i].removeAllListeners()
        }

        this.trial_data['error'] = this.trial_error
        this.trial_data['reward'] = this.reward
        this.trial_data['selection'] = this.selection

        this.all_trial_data.push(this.trial_data)

        // next trial, delay based on punishment
        this.time.delayedCall(punish_delay, () => {
          this.time.delayedCall(TRIAL_DELAY, () => {
            this.next_trial()
          })
        })
      }
      break
    case states.END:
      if (this.entering) {
        this.entering = false
        this.scene.start('EndScene', this.all_trial_data)
        // fade out
        // this.tweens.addCounter({
        //   from: 255,
        //   to: 0,
        //   duration: 2000,
        //   onUpdate: (t) => {
        //     let v = Math.floor(t.getValue())
        //     this.cameras.main.setAlpha(v / 255)
        //   },
        //   onComplete: () => {
        //     // this.scene.start('QuestionScene', { question_number: 1, data: this.all_data })
        //     this.scene.start('EndScene', this.all_data)
        //   }
        // })
        
      }
      break
    }
  } // end update

  get state() {
    return this._state
  }

  set state(newState) {
    this.entering = true
    this._state = newState
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
      if (this.cur_trial_ix >= this.trials.length) {
        this.state = states.END
        return
      } else {
        this.current_trial = this.trials[this.cur_trial_ix]
      }
      
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
