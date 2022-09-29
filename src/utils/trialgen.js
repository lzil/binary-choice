

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
  1: 1,
  2: 2
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
      trial.values = Array(3).fill(0.25 + 0.5 * probe_value)
      // let reward_value = Math.round(probe_value * 2)
      // trial.rewards = Array(3).fill(rewardsMap[reward_value])
      trial.rewards = Array(3).fill(1)
      // trial.rewards[randint(0,n_targets-1)] = 5
    } else {
      let values = []
      for (let j = 0; j < 3; j++) {
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

    
  }
  return trials
}
