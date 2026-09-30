export class ActionController {
  constructor(avatarController, animationController, emotionController, lipSyncController, sceneManager, uiCallbacks) {
    this.avatarController = avatarController;
    this.animationController = animationController;
    this.emotionController = emotionController;
    this.lipSyncController = lipSyncController;
    this.sceneManager = sceneManager;
    this.uiCallbacks = uiCallbacks || {}; // { onLeave, onReturn, showDialogue }

    this.headPatQuotes = [
      { text: "嘿嘿……不要一直摸我的頭啦～人家會害羞的！", emotion: "shy" },
      { text: "主人的手好溫暖……最喜歡主人摸摸頭了！", emotion: "caring" },
      { text: "嗯～乖乖接受主人的誇獎，今天小櫻表現還可以吧？", emotion: "happy" },
      { text: "摸摸頭很舒服呢……主人今天也要加油哦！", emotion: "happy" }
    ];
  }

  async dispatch(intent, audioBase64 = null) {
    if (!intent) return;
    const { reply, emotion, action, costume } = intent;

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

      case 'wave':
        this.animationController.playWave();
        break;

      case 'head_pat':
        this.triggerHeadPat();
        break;

      case 'idle':
      default:
        this.animationController.resetToIdle();
        break;
    }

    // 4. Play audio and lip sync if audio is provided
    if (audioBase64) {
      await this.lipSyncController.playAudioBase64(audioBase64);
      // Reset emotion to gentle/neutral after speech ends
      setTimeout(() => {
        this.emotionController.setEmotion('neutral');
      }, 1000);
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
