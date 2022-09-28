

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

function randint(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export default function generateTrials(params, is_debug = false) {
  let trials = []
  const n_trials = params.n_trials

  for (let i = 0; i < n_trials; i++) {
    let trial = {ix: i}
    trial.type = 'normal'

    // whether it's left middle or right
    let values = []
    let val = Math.random()
    let correct_idx = 0
    if (val < 1/3) {
      values = [1,0,0]
    } else if (val < 2/3) {
      values = [0,1,0]
      correct_idx = 1
    } else {
      values = [0,0,1]
      correct_idx = 2
    }
    // when does correct target appear
    let appear_dist_ratio = randint(0,2)
    appear_dist_ratio = .6 + .1 * appear_dist_ratio

    // which set of targets
    let target_set = 0
    if (Math.random() < .5) {
      target_set = 1
    }
    
    trial.values = values
    trial.appear_dist_ratio = appear_dist_ratio
    trial.target_set = target_set
    trial.correct_idx = correct_idx
    
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
