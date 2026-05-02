// @ts-nocheck
export default {
  /** Hop / death SFX for the playable character (generic, not tied to a specific mascot). */
  player: {
    move: {
      '0': require('../../../assets/minigames/cyberroad/audio/buck1.wav'),
      '1': require('../../../assets/minigames/cyberroad/audio/buck2.wav'),
      '2': require('../../../assets/minigames/cyberroad/audio/buck3.wav'),
      '3': require('../../../assets/minigames/cyberroad/audio/buck4.wav'),
      '4': require('../../../assets/minigames/cyberroad/audio/buck5.wav'),
      '5': require('../../../assets/minigames/cyberroad/audio/buck6.wav'),
      '6': require('../../../assets/minigames/cyberroad/audio/buck7.wav'),
      '7': require('../../../assets/minigames/cyberroad/audio/buck8.wav'),
      '8': require('../../../assets/minigames/cyberroad/audio/buck9.wav'),
      '9': require('../../../assets/minigames/cyberroad/audio/buck10.wav'),
      '10': require('../../../assets/minigames/cyberroad/audio/buck11.wav'),
      '11': require('../../../assets/minigames/cyberroad/audio/buck12.wav'),
    },
    die: {
      '0': require('../../../assets/minigames/cyberroad/audio/runner_death_1.wav'),
      '1': require('../../../assets/minigames/cyberroad/audio/runner_death_2.wav'),
    },
  },
  car: {
    passive: {
      '0': require('../../../assets/minigames/cyberroad/audio/car-engine-loop-deep.wav'),
      '1': require('../../../assets/minigames/cyberroad/audio/car-horn.wav'),
    },
    die: {
      '0': require('../../../assets/minigames/cyberroad/audio/carhit.mp3'),
      '1': require('../../../assets/minigames/cyberroad/audio/carsquish3.wav'),
    },
  },
  bg_music: require('../../../assets/minigames/cyberroad/audio/car-engine-loop-deep.wav'),

  button_in: require('../../../assets/minigames/cyberroad/audio/Pop_1.wav'),
  button_out: require('../../../assets/minigames/cyberroad/audio/Pop_2.wav'),

  banner: require('../../../assets/minigames/cyberroad/audio/bannerhit3-g.wav'),
  water: require('../../../assets/minigames/cyberroad/audio/watersplashlow.mp3'),
  trainAlarm: require('../../../assets/minigames/cyberroad/audio/Train_Alarm.wav'),
  train: {
    move: {
      '0': require('../../../assets/minigames/cyberroad/audio/train_pass_no_horn.wav'),
      '1': require('../../../assets/minigames/cyberroad/audio/train_pass_shorter.wav'),
    },
    die: {
      '0': require('../../../assets/minigames/cyberroad/audio/trainsplat.wav'),
    },
  },
};
