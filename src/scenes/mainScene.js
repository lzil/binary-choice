import { TypingText } from '../objects/typingtext'
import { Enum } from '../utils/enum'
import { clamp } from '../utils/clamp'
import { randint, randchoice } from '../utils/rand'
import generateTrials from '../utils/trialgen'


const WHITE = 0xffffff
const GREEN = 0x39ff14 // actually move to the target
const RED = 0xff0000
const BLACK = 0x000000
const BRIGHTRED = Phaser.Display.Color.GetColor(175, 50, 50)
const DARKGRAY = 0x444444
const GRAY = Phaser.Display.Color.GetColor(100, 100, 100)
const LIGHTGRAY = Phaser.Display.Color.GetColor(150, 150, 150)
const CYAN = Phaser.Display.Color.GetColor(100, 150, 250)
const SALMON = Phaser.Display.Color.GetColor(250, 100, 100)
const ORANGE = 0xffa500

const TARGET_SIZE_RADIUS = 75
const ORIGIN_SIZE_RADIUS = 15
const MOVE_THRESHOLD = 4

const TARGET_DISTANCE = 850 // *hopefully* they have 300px available?
const TARGET_SHOW_DISTANCE = 800
const TARGET_REF_ANGLE = 270 // degrees, and should be pointed straight up
const TARGET_ANGLE = 50
const MOVE_TIME_LIMIT = 900
const PRACTICE_REACH_TIME_LIMIT = 2000
const REACH_TIME_LIMIT = 800
const CURSOR_START_Y = 450

const SPEED_LIMIT = 1.5

const MED_TIME_MULTIPLIER = 2

const TRIAL_DELAY = 1000
const PRACTICE_TRIAL_PUNISH_DELAY = 200
const TRIAL_PUNISH_DELAY = 1500

const TASK_POINT_GOAL = 300

const states = Enum([
  'INSTRUCT', // show text instructions (based on stage of task)
  'PRETRIAL', // wait until ready to start trial
  'MOVING', // the movement part
  'POSTTRIAL', // auto teleport back to restore point
  'END' //
])

const Err = {
  none: 0,
  too_far: 1,
  too_slow_move: 2,
  too_slow_reach: 4,
  returned_reach: 8,
  too_fast_reach: 16
}

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' })
    this._state = states.INSTRUCT    

  }

  preload() {
    this.load.image('next', 'assets/next_instructions.png')
    this.load.image('next_debug', 'assets/next_debug.png')
    this.load.image('previous', 'assets/previous_instructions.png')
    this.load.image('finish', 'assets/ticket.png')
  }

  create() {
    let config = this.game.config
    let user_config = this.game.user_config
    // camera (origin is center)
    this.hd2 = config.height/2
    this.wd2 = config.width/2
    this.cameras.main.setBounds(-this.wd2, -this.hd2, this.wd2*2, this.hd2*2)
    
    this.state = states.INSTRUCT
    this.entering = true
    this.all_trial_data = []

    // variables to start off with
    this.trial_counter = 0
    this.instruct_mode = 1
    this.points_count = 0
    // this.selection_counts = Array(3).fill(1/3)
    this.instructions_shown = false

    this.n_trials = 1000
    this.probe_prob = 3/10
    this.easy_prob = 3/10
    this.distance_mode = true
    this.difficulty = 5

    this.is_debug = user_config.is_debug
    if (this.is_debug) {
      this.instruct_mode = 1
      this.n_trials = 50
      this.probe_prob = 0
      this.easy_prob = 0
      this.difficulty = 4
    }

    // fancy "INSTRUCTIONS" title
    this.instructions_title_group = this.add.group()
    this.instructions_title_group.add(this.add.rectangle(-310, -480, 425, 80, SALMON, 0.9))
    this.instructions_title_group.add(this.add.rectangle(-300, -470, 425, 80, CYAN, 0.9))
    this.instructions_title_group.add(this.add.text(-500, -500, 'INSTRUCTIONS', {
      fontFamily: 'Verdana',
      fontSize: 50,
      align: 'left'
    }))

    // secret finish button
    this.finish = this.add.rectangle(this.wd2,this.hd2,50,50).setInteractive().on('pointerdown',()=>{this.scene.start('EndScene', this.all_trial_data)})

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
        this.trial_success_count = 0

      })

    let instructions_font_params = {
      fontFamily: 'Verdana', 
      fontSize: 30,
      align: 'left'
    }


    var graphics = this.add.graphics();
    graphics.fillGradientStyle(0x999999, BLACK, BLACK, BLACK, 1, 0,0,0);
    const n_triangle_pts = 30
    const light_distance = 600
    let unit_rad = 2 * Math.PI / n_triangle_pts
    let x0 = 0
    let y0 = 0
    // this.light_circle = this.add.circle(x0, y0, light_distance - 10, WHITE, 0).setDepth(-1)
    this.light_triangles = []
    for (let i = 0; i < n_triangle_pts; i++) {
      let rads = i * unit_rad
      let x1 = x0 + light_distance * Math.cos(rads)
      let y1 = y0 + light_distance * Math.sin(rads)
      let x2 = x0 + light_distance * Math.cos(rads + unit_rad)
      let y2 = y0 + light_distance * Math.sin(rads + unit_rad)
      this.light_triangles.push(graphics.fillTriangle(x0, y0, x1, y1, x2, y2).setDepth(-2).setVisible(false))
    }

    // distance_mode instructions
    this.instructions_group_1 = this.add.group()
    this.instructions_group_1.add(this.add.rexBBCodeText(-500, -350,
      '[b]In this game[/b], score points by moving a cursor to circular targets.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.rectangle(-450, -260, 100, 10, WHITE).setVisible(false))
    this.instructions_group_1.add(this.add.rexBBCodeText(-500, -210,
      'Start a trial by moving your mouse to a [b]white[/b] circle at the\nbottom of the screen.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.rexBBCodeText(-500, -100,
      'The [b]white[/b] circle will turn [b][color=#39ff14]green[/color][/b], and three targets will appear\nnear the top of the screen. The [b][color=#FFAA00]gold target[/color][/b] is worth 3 points,\nand the [b][color=#DD3232]red targets[/color][/b] are worth 1 point.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.rexBBCodeText(-500, 40,
      'Move the cursor to a target to select it, but watch out - if you reach\ntoo far or take too long, you get no points.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.rectangle(-450, 150, 100, 10, WHITE).setVisible(false))
    this.instructions_group_1.add(this.add.rexBBCodeText(-500, 190,
      '[b]The catch[/b]: your vision is limited, and targets far from your\ncursor will be hard to see. The cursor will automatically follow\nyour mouse, but it has a maximum speed.',
      instructions_font_params).setVisible(false))
    this.instructions_group_1.add(this.add.rexBBCodeText(-500, 340,
      'Let\'s start with some practice rounds.',
      instructions_font_params).setVisible(false))

    // instructions during practice rounds
    this.instructions_holdwhite = this.add.text(50, 430, '<<   Move your mouse here', instructions_font_params).setVisible(false)
    this.instructions_moveup = this.add.text(100, 300, 'Move your mouse upwards...', instructions_font_params).setVisible(false)
    this.instructions_hitred = this.add.text(0, -550, 'Hit one of these targets!', {
      fontFamily: 'Verdana',
      fontSize: 30,
      align: 'center'
    }).setVisible(false).setOrigin(0.5, 0.5)

    // practice round trials
    let trial_params_1 = {
      n_trials: 10,
      difficulty: 0,
      probe_prob: 0,
      easy_prob: 0,
    }
    this.practice_trials_1 = generateTrials(trial_params_1)
    

    // second page of instructions, before starting
    this.instructions_group_2 = this.add.group()
    this.instructions_group_2.add(this.add.text(-500, -350,
      'Good job!\n\nNow, the actual game will be more difficult. You will have\nless time to move, and the colors will look more similar.\nJust try your best!',
      instructions_font_params).setVisible(false))
    this.instructions_group_2.add(this.add.rexBBCodeText(-500, -120,
      '[b]One more hint[/b]: the more you select a certain target relative\nto the others, the more likely that target will be worth [b]only 1\npoint[/b] in future trials.',
      instructions_font_params).setVisible(false))
    this.instructions_group_2.add(this.add.rexBBCodeText(-500, 30,
      `The task will end once you reach [b][color=#39ff14]${TASK_POINT_GOAL}[/color][/b] points.`,
      instructions_font_params).setVisible(false))
    this.instructions_group_2.add(this.add.rexBBCodeText(-500, 150,
      '[b]Once you are ready, click the arrow to begin.[/b]',
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
    for (let i = 0; i < degs.length; i++) {
      let deg = degs[i]
      let radians = Phaser.Math.DegToRad(deg)
      let x = TARGET_DISTANCE * Math.cos(radians)
      let y = TARGET_DISTANCE * Math.sin(radians)
      let target_obj = this.add.circle(x, y + CURSOR_START_Y, TARGET_SIZE_RADIUS, BRIGHTRED).setStrokeStyle(8,WHITE).setDepth(3).setVisible(false)

      this.target_objs.push(target_obj)
    }

    // actual trials for the experiment

    // some easy trials
    // let trial_params = {
    //   n_trials: this.n_trials,
    //   distance_mode: this.distance_mode,
    //   difficulty: 0,
    //   probe_prob: this.probe_prob,
    //   n_targets: 3,
    // }
    // this.trials = generateTrials(trial_params)


    let trial_params = {
      n_trials: this.n_trials,
      difficulty: this.difficulty,
      probe_prob: this.probe_prob,
      easy_prob: this.easy_prob,
    }
    this.trials = generateTrials(trial_params)

  } // end create


  reset_targets() {
    for (let i = 0; i < this.target_objs.length; i++) {
      this.target_objs[i].setFillStyle(BRIGHTRED).setStrokeStyle(0).setVisible(false)
    }
    this.origin_obj.setVisible(false)
    this.light_triangles.forEach(t => t.setVisible(false))
    this.origin_obj.setPosition(0, CURSOR_START_Y)
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
        console.log(this.cur_trial_ix, this.current_trial.type, this.current_trial.difficulty)
        if (this.is_debug) {
          console.log(this.current_trial.values)
        }
        this.difficulty_factor = this.current_trial.difficulty || 1
        this.instructions_shown = true
        // how long you have to be inside circle to start trial
        this.hold_val = randint(300, 600)
        this.reset_targets()
        this.origin_obj.setVisible(true)
        this.reward_txt.setVisible(false)
        this.hold_waiting = false
        this.origin_obj.fillColor = WHITE
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
        this.pointer_data = {'time': [], 'x': [], 'y': [], 'cx': [], 'cy': [], 'moving': []}
        
      }

      // check if cursor inside start circle
      // console.log(this.input.activePointer.x-this.wd2, this.origin.x, this.input.activePointer.y-this.hd2, this.origin.y)
      let mouse_in_origin = this.origin.contains(
        this.input.activePointer.x - this.wd2,
        this.input.activePointer.y - this.hd2)
      if (mouse_in_origin && !this.hold_waiting) {
        this.hold_start_time = this.game.loop.now
        this.hold_waiting = true;
      } else if (!mouse_in_origin && this.hold_waiting) {
        this.hold_waiting = false;
      }

      // wait for cursor inside start circle
      if (this.hold_waiting) {
        if (this.game.loop.now - this.hold_start_time > this.hold_val) {
          this.hold_waiting = false;
          this.state = states.MOVING
        }
      }
      
      break

    case states.MOVING:
      if (this.entering) {
        this.entering = false
        this.moving = false
        console.log("Entering MOVING")

        this.origin_obj.fillColor = GREEN

        // start time is when the circle turns green
        // start time != target show time. record all timestamps anyway, relative to start time
        this.start_time = this.game.loop.now
        this.trial_data['start_time_abs'] = this.start_time
        this.trial_data['pretrial_time'] = this.pretrial_time - this.start_time
        console.log(this.trial_data['pretrial_time'], 'pretrial_time')
        console.log(0, 'start_time')

        // instructions guiding movements
        if (this.instruct_mode === 1) {
          this.instructions_holdwhite.setVisible(false)
          this.instructions_hitred.setVisible(true)
          if (!this.distance_mode) {
            this.instructions_moveup.setVisible(true)
          }
        }

        // show targets from beginning
        for (let j = 0; j < this.target_objs.length; j++) {
          // let value_coef = 2 * (this.current_trial.values[j] - 0.5)
          let red_shade = 180
          let red_rgb_color = Phaser.Display.Color.GetColor(red_shade, 50, 50)
          this.target_objs[j].setFillStyle(red_rgb_color).setAlpha(0.2).setVisible(true)
        }
      }

      // main loop, executed always
      let cur_time = this.game.loop.now
      let pointerx = this.input.activePointer.x - this.wd2
      let pointery = this.input.activePointer.y - this.hd2
      let cursorx = this.origin_obj.x
      let cursory = this.origin_obj.y
      let cur_trial_time = cur_time - this.start_time

      // time, x, y, moving
      this.pointer_data.time.push(cur_trial_time)
      this.pointer_data.x.push(pointerx)
      this.pointer_data.y.push(pointery)
      this.pointer_data.cx.push(cursorx)
      this.pointer_data.cy.push(cursory)
      this.pointer_data.moving.push(this.moving)

      // check if cursor is past target radius + radius of target
      let pdist = Phaser.Math.Distance.Between(cursorx, cursory, this.origin.x, this.origin.y)
      if (pdist >= TARGET_DISTANCE + TARGET_SIZE_RADIUS) {
        this.trial_error = Err.too_far
        this.reward = 0
        this.selection = -1
        this.value = 0
        this.state = states.POSTTRIAL
      }

      // has participant started moving yet?
      if (!this.moving) {
        let mouse_in_origin = this.origin.contains(pointerx, pointery)
        if (!mouse_in_origin) {
          this.moving = true
          this.last_pdist = pdist
          this.move_time = cur_time
          this.trial_data['move_time'] = cur_trial_time
          console.log(cur_trial_time, 'move_time')

          this.origin_obj.fillColor = WHITE
          this.light_triangles.forEach(t => {
            t.setVisible(true)
          })

          if (this.instruct_mode === 1) {
            this.instructions_hitred.setVisible(true)
          }
        }
      }

      // once we're moving...
      if (this.moving) {
        let reaching_trial_time = cur_time - this.move_time

        // move origin cursor, and light circle
        let vec = new Phaser.Math.Vector2(pointerx - cursorx, pointery - cursory)
        let speed = vec.length() / (cur_time - this.prev_time)
        speed = Math.min(speed, SPEED_LIMIT) * (cur_time - this.prev_time)

        vec = vec.limit(speed)

        this.origin_obj.setPosition(cursorx + vec.x, cursory + vec.y)
        this.light_triangles.forEach(t => {
          t.setPosition(cursorx + vec.x, cursory + vec.y)
        })


        // are we past the reaching time limit?
        let time_lim = REACH_TIME_LIMIT
        if (this.instruct_mode > 0) {
          time_lim = PRACTICE_REACH_TIME_LIMIT
        }
        if (reaching_trial_time > time_lim) {
          console.log('hit the limit!', reaching_trial_time)
          this.trial_error = Err.too_slow_reach
          this.state = states.POSTTRIAL
        }

        // setting target colors in distance mode
        for (let j = 0; j < this.target_objs.length; j++) {
          let target = this.target_objs[j]
          let tdist = Phaser.Math.Distance.Between(cursorx, cursory, target.x, target.y)
          let difficulty_factor = this.current_trial.difficulty || 1
          let tdist_coef = Math.max(0.2, 1 - Math.pow(tdist / TARGET_DISTANCE, 1))
          let pdist_coef = Math.min(1, pdist / ORIGIN_SIZE_RADIUS / 4)
          // let value_coef = 2 * (this.current_trial.values[j] - 0.5)

          let value_coef = 1
          // let red_shade = 180 + value_coef * pdist_coef * (8 - this.difficulty_factor) * 10
          let red_shade = 220
          let red_rgb_color = Phaser.Display.Color.GetColor(red_shade, 50, 50)
          if (this.current_trial.rewards[j] == 3) {
            let odist_coef = Math.max(0, 1 - Math.pow(tdist / TARGET_DISTANCE, 1/2))
            let green_shade = 50 + odist_coef * 90
            red_rgb_color = Phaser.Display.Color.GetColor(red_shade, green_shade, 50)
          }
          
          this.target_objs[j].setFillStyle(red_rgb_color).setAlpha(tdist_coef)
        }

        // did cursor hit the targets?
        for (let i = 0; i < this.target_objs.length; i++) {
          let target = this.target_objs[i]
          if (Phaser.Math.Distance.Between(cursorx, cursory, target.x, target.y) < TARGET_SIZE_RADIUS + ORIGIN_SIZE_RADIUS) {
            this.target_objs[i].setStrokeStyle(8, WHITE)
            this.selection = i
            this.value = this.current_trial.values[i]
            // if reward is 3, maybe make it not 3
            let reward = this.current_trial.rewards[i]
            this.reward = reward
            // if (this.instruct_mode == 0 && reward != 1) {
            //   let selection_ratio = this.selection_counts[i] - 1/3
            //   console.log('selection ratio:', selection_ratio)
            //   if (selection_ratio > 0 && Math.random() < selection_ratio) {
            //     if (reward == 2) {
            //       console.log('changing reward to 1')
            //       this.reward = 1
            //     } else {
            //       // console.log('changing reward to 2')
            //       // this.reward = 2
            //     }
            //   }
            // }
            // if (this.instruct_mode == 0) {
            //   this.selection_counts = this.selection_counts.map(x=>x*5/6)
            //   this.selection_counts[i] += 1/6
            // }
            this.trial_success_count++
            this.trial_error = Err.none
            
            this.state = states.POSTTRIAL
          }
        }

      } else {
        // if not moving yet
        // check if we're overtime (to reach), before targets are shown
        if (cur_trial_time > MOVE_TIME_LIMIT) {
          this.trial_error = Err.too_slow_move
          this.move_time = -1
          this.state = states.POSTTRIAL
        }

      }

      this.prev_time = cur_time

      break

    case states.POSTTRIAL:
      if (this.entering) {
        this.entering = false

        if (this.instruct_mode === 1) {
          this.instructions_hitred.setVisible(false)
        }
        this.origin_obj.fillColor = WHITE
        this.end_time = this.game.loop.now
        // gives incorrect results if we didn't move this trial
        this.trial_data['end_time'] = this.end_time - this.start_time
        this.trial_data['trial_time'] = this.end_time - this.move_time
        console.log(this.trial_data['trial_time'], 'trial time')

        this.trial_data['pointer_data'] = this.pointer_data
        // console.log(this.trial_data)

        let punish_delay = 0
        if (this.trial_error === Err.none) {
          // no error happened
          let reward_txt;
          if (this.instruct_mode === 1) {
            if (this.reward === 1) {
              reward_txt = "This target is worth 1 point."
            } else {
              reward_txt = `This target is worth ${this.reward} points!`
            }
          } else  {
            if (this.reward === 1) {
              reward_txt = "You received 1 point."
            } else {
              reward_txt = `You received ${this.reward} points!`
            }
          }
          this.reward_txt.setText(reward_txt)
        } else {
          // some error happened
          if (this.instruct_mode == 1) {
            this.trial_success_count = 0
          }
          this.reward = 0
          this.selection = -1
          this.value = 0
          if (this.trial_error === Err.too_slow_move) {
            this.reward_txt.setText('Please start your movement faster.')
          } else if (this.trial_error === Err.too_slow_reach) {
            this.reward_txt.setText('Too slow!')
          } else if (this.trial_error === Err.too_far || this.trial_error === Err.returned_reach) {
            this.reset_targets()
            this.reward_txt.setText('Move your cursor toward one of the targets.')
          } else if (this.trial_error === Err.too_fast_reach) {
            this.reset_targets()
            this.reward_txt.setText('Please move the cursor slower.')
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

        console.log(`reward: ${this.reward}; success count: ${this.trial_success_count}`)

        // next trial, delay based on punishment
        this.time.delayedCall(punish_delay, () => {
          this.time.delayedCall(TRIAL_DELAY, () => {
            if (this.points_count >= TASK_POINT_GOAL) {
              this.state = states.END
            } else {
              this.next_trial()
            }
          })
        })
      }
      break
    case states.END:
      if (this.entering) {
        this.entering = false
        this.scene.start('EndScene', this.all_trial_data)
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
    if (this.instruct_mode === 1) {
      // console.log(this.trial_success_count)
      if (this.trial_success_count >= 4) {
        this.instruct_mode = 2
        this.state = states.INSTRUCT
        return
      }
      this.cur_trial_ix = (this.cur_trial_ix + 1) % this.practice_trials_1.length
      this.current_trial = this.practice_trials_1[this.cur_trial_ix]
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

    this.state = states.PRETRIAL
  }
}
