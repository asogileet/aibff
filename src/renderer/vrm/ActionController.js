export class ActionController {
  constructor(avatarController, animationController, emotionController, lipSyncController, sceneManager, uiCallbacks) {
    this.avatarController = avatarController;
    this.animationController = animationController;
    this.emotionController = emotionController;
    this.lipSyncController = lipSyncController;
    this.sceneManager = sceneManager;
    this.uiCallbacks = uiCallbacks || {}; // { onLeave, onReturn, showDialogue, onPatSpeech }

    this.headPatQuotes = [
      { text: "嘿嘿……不要一直摸我的頭啦～人家會害羞的！", emotion: "shy" },
      { text: "主人的手好溫暖……最喜歡主人摸摸頭了！", emotion: "caring" },
      { text: "嗯～乖乖接受主人的誇獎，今天小櫻表現還可以吧？", emotion: "happy" },
      { text: "摸摸頭很舒服呢……主人今天也要加油哦！", emotion: "happy" }
    ];

    this.actionDefaultQuotes = {
      heart_pose: { text: "給主人一個大大的愛心！今天也要超級開心哦～", emotion: "shy" },
      wave: { text: "主人好呀！小櫻隨時都在這裡陪著你哦～", emotion: "happy" },
      bow: { text: "十分感謝主人的照顧！今後也請多多指教呢～", emotion: "happy" },
      tilt_head: { text: "嗯？主人在看小櫻嗎？小櫻今天可愛嗎～？", emotion: "happy" },
      clap: { text: "哇！太棒太厲害了！主人真是太優秀啦！", emotion: "happy" },
      stretch: { text: "哈啊～好舒服！主人也跟小櫻一起站起來動一動吧～", emotion: "caring" },
      cheer: { text: "萬歲！太好了！今天真是最棒的一天呢！", emotion: "happy" },
      nod: { text: "嗯嗯！小櫻完全贊成主人的想法哦！", emotion: "happy" },
      shake_head: { text: "不可以這樣啦～主人偶爾也要聽小櫻的話嘛！", emotion: "shy" },
      pout: { text: "哼～！主人如果再不理小櫻，小櫻可真的要生氣囉！", emotion: "angry" },
      sit: { text: "小櫻乖乖坐下了哦，主人要坐在小櫻旁邊嗎？", emotion: "happy" },
      run: { text: "一、二、一、二！跟主人一起運動跑步真開心！", emotion: "happy" },
      jump: { text: "嘿咻——！跳得很高吧？小櫻今天活力滿滿呢！", emotion: "happy" },
      squat: { text: "蹲在地上抬頭看主人，視角好特別呢～", emotion: "happy" },
      kneel: { text: "正襟跪坐……主人有什麼重要的事要吩咐小櫻嗎？", emotion: "caring" },
      stand: { text: "小櫻站好囉！主人還有什麼想看的動作嗎？", emotion: "happy" }
    };
  }

  async dispatch(intent, audioBase64 = null) {
    if (!intent) return;
    let { reply, emotion, action, costume } = intent;

    // Default quote fallback if triggered without text
    if (!reply && action && this.actionDefaultQuotes[action]) {
      reply = this.actionDefaultQuotes[action].text;
      if (!emotion) emotion = this.actionDefaultQuotes[action].emotion;
    }

    // 1. Set Emotion
    if (emotion) {
      this.emotionController.setEmotion(emotion);
    }

    // 2. Display Dialogue text in UI
    if (reply && typeof this.uiCallbacks.showDialogue === 'function') {
      this.uiCallbacks.showDialogue(reply, emotion || 'happy');
    }

    // 3. Dispatch Animation & System Action
    switch (action) {
      case 'leave':
        await this._handleLeave(reply, audioBase64);
        return;

      case 'return':
        await this._handleReturn(reply, audioBase64);
        return;

      case 'change_costume':
        await this._handleCostumeChange(costume, reply, audioBase64);
        return;

      case 'heart_pose':
        this.sceneManager.spawnHeartParticles(10);
        this.animationController.playHeartPose();
        break;

      case 'bow':
        this.animationController.playBow();
        break;

      case 'clap':
        this.animationController.playClap();
        break;

      case 'tilt_head':
        this.animationController.playTiltHead();
        break;

      case 'stretch':
        this.animationController.playStretch();
        break;

      case 'cheer':
        this.sceneManager.spawnHeartParticles(6);
        this.animationController.playCheer();
        break;

      case 'nod':
        this.animationController.playNod();
        break;

      case 'shake_head':
        this.animationController.playShakeHead();
        break;

      case 'pout':
        this.animationController.playPout();
        break;

      case 'sit':
        this.animationController.playSit();
        break;

      case 'run':
        this.animationController.playRun();
        break;

      case 'jump':
        this.sceneManager.spawnHeartParticles(8);
        this.animationController.playJump();
        break;

      case 'squat':
        this.animationController.playSquat();
        break;

      case 'kneel':
        this.animationController.playKneel();
        break;

      case 'wave':
        this.animationController.playWave();
        break;

      case 'head_pat':
        this.triggerHeadPat();
        break;

      case 'stand':
      case 'idle':
      default:
        this.animationController.resetToIdle();
        break;
    }

    // 4. Play audio and lip sync if audio is provided
    if (audioBase64) {
      await this.lipSyncController.playAudioBase64(audioBase64);
      setTimeout(() => {
        this.emotionController.setEmotion('neutral');
      }, 1000);
    } else if (reply && typeof this.uiCallbacks.onPatSpeech === 'function' && !intent.skipTTS) {
      this.uiCallbacks.onPatSpeech(reply);
    }
  }

  async _handleLeave(reply, audioBase64) {
    this.animationController.playWave();
    if (audioBase64) {
      await this.lipSyncController.playAudioBase64(audioBase64);
    }

    // Trigger leave UI transition (show pink pulsing heart)
    if (typeof this.uiCallbacks.onLeave === 'function') {
      this.uiCallbacks.onLeave();
    }
  }

  async _handleReturn(reply, audioBase64) {
    if (typeof this.uiCallbacks.onReturn === 'function') {
      this.uiCallbacks.onReturn();
    }

    this.sceneManager.spawnHeartParticles(8);
    this.animationController.playWave();
    this.emotionController.setEmotion('happy');

    if (audioBase64) {
      await this.lipSyncController.playAudioBase64(audioBase64);
    }
  }

  async _handleCostumeChange(costumeKey, reply, audioBase64) {
    if (!costumeKey) costumeKey = 'casual';

    // Play 360 degree spin and particle burst
    this.sceneManager.spawnHeartParticles(12);
    this.animationController.playSpin(async () => {
      await this.avatarController.loadCostume(costumeKey);
      this.sceneManager.spawnHeartParticles(6);
    });

    if (audioBase64) {
      await this.lipSyncController.playAudioBase64(audioBase64);
    }
  }

  triggerHeadPat(hitPoint = null) {
    const quote = this.headPatQuotes[Math.floor(Math.random() * this.headPatQuotes.length)];
    this.emotionController.setEmotion(quote.emotion);
    this.sceneManager.spawnHeartParticles(6, hitPoint || undefined);

    if (typeof this.uiCallbacks.showDialogue === 'function') {
      this.uiCallbacks.showDialogue(quote.text, quote.emotion);
    }

    if (typeof this.uiCallbacks.onPatSpeech === 'function') {
      this.uiCallbacks.onPatSpeech(quote.text);
    }
  }
}
