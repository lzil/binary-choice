/*
NB target distance is a constant in main
center & target sizes are consts in main
{
    ask_questions: bool,
    is_clamped: bool,
    clamp_angle: float,
    trial_type: str,
    is_masked: bool, // mask duration is staircased
}
*/

/*
repeats (default 40?) is number of repeats per clamp type (left vs right)
*/

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

function argMax(array) {
  return [].reduce.call(array, (m, c, i, arr) => c > arr[m] ? i : m, 0)
}


const rewardsMap = {
  0: 1,
  1: 5,
  2: 10
}

function getRewards(values) {
  let len = values.length;
  let indices = new Array(len);
  for (let i = 0; i < len; ++i) indices[i] = i;
  indices.sort(function (a, b) { return values[a] < values[b] ? -1 : values[a] > values[b] ? 1 : 0; });
  let rewards = new Array(len)
  for (let i = 0; i < len; ++i) {
    let val = indices[i]
    rewards[val] = rewardsMap[i];
  }
  // console.log(values, rewards)
  return rewards
}

function getUnbalancedRewards(values) {
  let len = values.length
  let rewards = new Array(len).fill(1)
  rewards[argMax(values)] = 5
  return rewards
}

function randint(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export default function generateTrials(params, is_debug = false) {
  let trials = []
  const n_trials = params['n_trials']
  const n_targets = params['n_targets']
  // const CLAMP_ANGLE = 15 // TODO: parameterize/pick something smarter?
  // let probe_trial_types = [
  //   { trial_type: 'probe', ask_questions: true, is_masked: true, is_clamped: true, clamp_angle: CLAMP_ANGLE },
  //   { trial_type: 'probe', ask_questions: true, is_masked: true, is_clamped: true, clamp_angle: -CLAMP_ANGLE }
  // ]

  let out = []

  // out.push({ trial_type: 'instruct_probe' })
  // do groups of 10 trials at a time. 5 each trial type, and control repeats (3 max?)
  // let n_trials = repeats * probe_trial_types.length
  // if (n_trials % 10 !== 0) {
  //   console.error('Make sure repeats leads to something divisible by 10.')
  //   console.error(`Repeats was ${repeats}, n_trials was ${n_trials}`)
  // }

  // generate 10 trials to use as prototype
  // let proto = Array(5).fill(probe_trial_types).flat()
  for (let i = 0; i < n_trials; i++) {
    let trial = {ix: i}
    trial.type = 'normal'
    trial.difficulty = params.difficulty

    // decides whether trial is probe, normal, or easy
    let trial_coin_toss = Math.random()
    if (trial_coin_toss > 1 - params.easy_prob) {
      trial.difficulty = 1
      trial.type = 'easy'
    }
    if (trial_coin_toss < params.probe_prob) {
      trial.type = 'probe'
      // trial.difficulty = 0
      let probe_value = Math.random()
      trial.values = Array(n_targets).fill(0.25 + 0.5 * probe_value)
      let reward_value = Math.round(probe_value * 2)
      trial.rewards = Array(3).fill(rewardsMap[reward_value])
      // trial.rewards = Array(n_targets).fill(1)
      // trial.rewards[randint(0,n_targets-1)] = 5
    } else {
      let values = []
      for (let j = 0; j < n_targets; j++) {
        values.push(Math.random())
      }
      if (params.difficulty === 0 && (Math.max(values) - Math.min(values) < 0.5)) {
        // too hard, repeat and make another one
        i--
      }
      trial.values = values
      trial.rewards = getRewards(values)
      // trial.rewards = getUnbalancedRewards(values)
    }
    
    trials.push(trial)
  //   whl: while (true) {
  //     shuffleArray(proto)
  //     // first check internal consistency
  //     for (let j = 3; j < proto.length; j++) {
  //       let pj = proto[j].clamp_angle
  //       if (pj === proto[j - 1].clamp_angle && pj === proto[j - 2].clamp_angle && pj === proto[j - 3].clamp_angle) {
  //         continue whl
  //       }
  //     }
  //     // then external consistency
  //     if (i > 0) {
  //       let len = out.length
  //       let p2 = proto[2].clamp_angle
  //       let p1 = proto[1].clamp_angle
  //       let p0 = proto[0].clamp_angle
  //       let pm1 = out[len - 1].clamp_angle
  //       let pm2 = out[len - 2].clamp_angle
  //       let pm3 = out[len - 3].clamp_angle

  //       if (p2 === p1 && p2 === p0 && p2 === pm1) {
  //         continue whl
  //       }
  //       if (p1 === p0 && p1 === pm1 && p1 === pm2) {
  //         continue whl
  //       }
  //       if (p0 === pm1 && p0 === pm2 && p0 === pm3) {
  //         continue whl
  //       }
  //     }
  //     break // we have proper order now
  //   }
  //   // add to out
  //   for (let j = 0; j < proto.length; j++) {
  //     out.push(proto[j])
  //   }
  // }

    
  }
  return trials
}
